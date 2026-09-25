#!/usr/bin/env python3
"""Prepare a public signing request or attach an approved public APK v2 block.
No signing key/password is read by this tool or needed in CI.
The result MUST pass Android SDK apksigner, zipalign and certificate checks.
Specification: https://source.android.com/docs/security/features/apksigning/v2
"""
import argparse, base64, hashlib, json, struct
from pathlib import Path
MAGIC=b'APK Sig Block 42'

def layout(data):
    eocd=data.rfind(b'PK\x05\x06',max(0,len(data)-65557))
    if eocd<0 or len(data)!=eocd+22+struct.unpack_from('<H',data,eocd+20)[0]:
        raise ValueError('Invalid EOCD')
    disk,central_disk,on_disk,total,central_size,central=struct.unpack_from('<HHHHII',data,eocd+4)
    if disk or central_disk or on_disk!=total or central+central_size!=eocd or total==65535:
        raise ValueError('Unsupported ZIP/ZIP64')
    if central>=16 and data[central-16:central]==MAGIC:
        raise ValueError('Input must be unsigned')
    return central,eocd

def apk_digest(data):
    central,eocd=layout(data)
    chunks=[]
    for section in (data[:central],data[central:eocd],data[eocd:]):
        for offset in range(0,len(section),1048576):
            chunk=section[offset:offset+1048576]
            chunks.append(hashlib.sha256(b'\xa5'+struct.pack('<I',len(chunk))+chunk).digest())
    return hashlib.sha256(b'\x5a'+struct.pack('<I',len(chunks))+b''.join(chunks)).hexdigest()

def request(data,commit):
    layout(data)
    if len(commit)!=40 or any(c not in '0123456789abcdef' for c in commit):
        raise ValueError('Invalid source commit')
    return dict(schema='cdq-detached-apk-v2-v1',algorithm=259,sourceCommit=commit,
                unsignedBytes=len(data),unsignedSha256=hashlib.sha256(data).hexdigest(),
                apkDigestSha256=apk_digest(data))

def attach(data,approval,expected):
    actual=request(data,expected['sourceCommit'])
    if expected!=actual or any(approval.get(k)!=v for k,v in actual.items()):
        raise ValueError('Unsigned release or source binding differs from approval')
    block=base64.b64decode(approval['signingBlockBase64'],validate=True)
    if not 64<len(block)<65536 or block[-16:]!=MAGIC:
        raise ValueError('Invalid public signing block')
    if struct.unpack_from('<Q',block)[0]!=len(block)-8 or struct.unpack_from('<Q',block,len(block)-24)[0]!=len(block)-8:
        raise ValueError('Signing block size mismatch')
    # Newer apksigner versions can insert zero page-alignment padding immediately
    # before the APK Signing Block. Keep the legacy V25.34 format at zero by
    # default, while allowing an independently approved deterministic padding.
    padding=approval.get('paddingBeforeSigningBlock',0)
    if type(padding) is not int or not 0<=padding<=4095:
        raise ValueError('Invalid signing-block padding')
    central,eocd=layout(data)
    inserted=padding+len(block)
    if central+inserted>0xffffffff:raise ValueError('ZIP64 not supported')
    end=bytearray(data[eocd:]);struct.pack_into('<I',end,16,central+inserted)
    return data[:central]+b'\\0'*padding+block+data[central:eocd]+end

def main():
    p=argparse.ArgumentParser();p.add_argument('mode',choices=['request','attach']);p.add_argument('--apk',required=True);p.add_argument('--commit');p.add_argument('--request');p.add_argument('--approval');p.add_argument('--output');a=p.parse_args()
    data=Path(a.apk).read_bytes()
    if a.mode=='request':print(json.dumps(request(data,a.commit),sort_keys=True))
    else:
        if not all([a.request,a.approval,a.output]):p.error('attach requires request, approval and output')
        Path(a.output).write_bytes(attach(data,json.loads(Path(a.approval).read_text()),json.loads(Path(a.request).read_text())))
        print('Public signature block attached; independent Android SDK verification remains mandatory.')
if __name__=='__main__':main()
