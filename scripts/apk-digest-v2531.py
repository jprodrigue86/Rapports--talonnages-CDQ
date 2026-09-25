#!/usr/bin/env python3
"""Public APK content digest / signing-block assembly. Never receives a private key."""
import base64,hashlib,json,os,struct,subprocess,sys
from pathlib import Path

def describe(data):
    e=data.rfind(b'PK\x05\x06',max(0,len(data)-65557))
    assert e>=0 and e+22+struct.unpack_from('<H',data,e+20)[0]==len(data)
    cdsize,cd=struct.unpack_from('<II',data,e+12)
    assert cd+cdsize==e and data[cd:cd+4]==b'PK\x01\x02'
    assert data[cd-16:cd]!=b'APK Sig Block 42','Expected an unsigned APK'
    chunks=[]
    for section in (data[:cd],data[cd:e],data[e:]):
        for offset in range(0,len(section),1048576):
            part=section[offset:offset+1048576]
            chunks.append(hashlib.sha256(b'\xa5'+struct.pack('<I',len(part))+part).digest())
    digest=hashlib.sha256(b'\x5a'+struct.pack('<I',len(chunks))+b''.join(chunks)).hexdigest()
    return {'unsignedSha256':hashlib.sha256(data).hexdigest(),'unsignedBytes':len(data),'centralDirectoryOffset':cd,'eocdOffset':e,'contentDigestSha256':digest}

if __name__=='__main__':
    mode,apk,other=sys.argv[1:4];data=Path(apk).read_bytes();meta=describe(data)
    if mode=='prepare':
        meta.update(versionName='25.31',versionCode=2531,sourceCommit=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),runId=int(os.environ['GITHUB_RUN_ID']))
        Path(other).parent.mkdir(parents=True,exist_ok=True);Path(other).write_text(json.dumps(meta,indent=2)+'\n');print(json.dumps(meta))
    elif mode=='assemble':
        recipe=json.loads(Path(other).read_text());assert recipe['versionCode']==2531 and recipe['versionName']=='25.31'
        for k,v in meta.items():assert recipe[k]==v,(k,'unsigned APK changed')
        block=base64.b64decode(recipe['signingBlockBase64'],validate=True)
        assert 32<len(block)<32768 and block[-16:]==b'APK Sig Block 42'
        assert struct.unpack_from('<Q',block)[0]==len(block)-8==struct.unpack_from('<Q',block,len(block)-24)[0]
        cd,e=meta['centralDirectoryOffset'],meta['eocdOffset'];tail=bytearray(data[e:]);struct.pack_into('<I',tail,16,cd+len(block))
        Path(sys.argv[4]).write_bytes(data[:cd]+block+data[cd:e]+tail)
    else:raise SystemExit('Unknown mode')
