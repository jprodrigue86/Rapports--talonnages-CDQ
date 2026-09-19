package ca.balancecdq.android

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.os.ParcelFileDescriptor
import android.os.ProxyFileDescriptorCallback
import android.os.storage.StorageManager
import android.provider.OpenableColumns
import java.io.FileNotFoundException
import java.net.HttpURLConnection
import java.net.URL
import java.util.LinkedHashMap
import kotlin.math.min

class DrivePdfProvider : ContentProvider() {
    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String = "application/pdf"

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor {
        val session = requireSession(uri)
        val cols = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val cursor = MatrixCursor(cols)
        val row = cursor.newRow()
        cols.forEach { col ->
            when (col) {
                OpenableColumns.DISPLAY_NAME -> row.add(session.fileName)
                OpenableColumns.SIZE -> row.add(session.size)
                else -> row.add(null)
            }
        }
        return cursor
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode != "r") throw FileNotFoundException("Lecture seule.")
        val ctx = context ?: throw FileNotFoundException("Contexte indisponible.")
        val session = requireSession(uri)
        val storage = ctx.getSystemService(StorageManager::class.java)
        val thread = HandlerThread("cdq-drive-pdf-${session.id.take(8)}")
        thread.start()
        val handler = Handler(thread.looper)

        return storage.openProxyFileDescriptor(
            ParcelFileDescriptor.MODE_READ_ONLY,
            DriveProxyCallback(session, thread),
            handler
        )
    }

    private fun requireSession(uri: Uri): PdfSession {
        val ctx = context ?: throw FileNotFoundException("Contexte indisponible.")
        val id = uri.lastPathSegment ?: throw FileNotFoundException("Session PDF manquante.")
        return PdfSessionStore.load(ctx, id)
            ?: throw FileNotFoundException("Session PDF expirée.")
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0

    private class DriveProxyCallback(
        private val session: PdfSession,
        private val thread: HandlerThread
    ) : ProxyFileDescriptorCallback() {
        private val blockSize = 512 * 1024L
        private val cache = object : LinkedHashMap<Long, ByteArray>(8, 0.75f, true) {
            override fun removeEldestEntry(eldest: MutableMap.MutableEntry<Long, ByteArray>?): Boolean {
                return size > 8
            }
        }

        override fun onGetSize(): Long = session.size

        @Synchronized
        override fun onRead(offset: Long, size: Int, data: ByteArray): Int {
            if (offset >= session.size) return 0
            val wanted = min(size.toLong(), session.size - offset).toInt()
            var copied = 0
            var pos = offset

            while (copied < wanted) {
                val blockStart = (pos / blockSize) * blockSize
                val block = cache[blockStart] ?: fetchBlock(blockStart).also {
                    cache[blockStart] = it
                }
                val inBlock = (pos - blockStart).toInt()
                if (inBlock >= block.size) break
                val count = min(wanted - copied, block.size - inBlock)
                System.arraycopy(block, inBlock, data, copied, count)
                copied += count
                pos += count
            }
            return copied
        }

        private fun fetchBlock(start: Long): ByteArray {
            val end = min(session.size - 1, start + blockSize - 1)
            val url = URL(
                "https://www.googleapis.com/drive/v3/files/" +
                    Uri.encode(session.fileId) +
                    "?alt=media&supportsAllDrives=true"
            )
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15000
                readTimeout = 30000
                setRequestProperty("Authorization", "Bearer ${session.accessToken}")
                setRequestProperty("Accept", "application/pdf")
                setRequestProperty("Range", "bytes=$start-$end")
            }

            try {
                val code = conn.responseCode
                if (code != 206 && code != 200) {
                    throw FileNotFoundException("Google Drive a refusé le PDF ($code).")
                }

                val bytes = conn.inputStream.use { input ->
                    if (code == 200 && start > 0L) {
                        var remaining = start
                        val skipBuffer = ByteArray(64 * 1024)
                        while (remaining > 0) {
                            val count = input.read(skipBuffer, 0, min(skipBuffer.size.toLong(), remaining).toInt())
                            if (count < 0) break
                            remaining -= count
                        }
                    }
                    val expected = (end - start + 1).toInt()
                    val out = ByteArray(expected)
                    var off = 0
                    while (off < expected) {
                        val count = input.read(out, off, expected - off)
                        if (count < 0) break
                        off += count
                    }
                    if (off == out.size) out else out.copyOf(off)
                }
                if (bytes.isEmpty()) throw FileNotFoundException("Bloc PDF vide.")
                return bytes
            } finally {
                conn.disconnect()
            }
        }

        override fun onRelease() {
            cache.clear()
            thread.quitSafely()
        }
    }
}
