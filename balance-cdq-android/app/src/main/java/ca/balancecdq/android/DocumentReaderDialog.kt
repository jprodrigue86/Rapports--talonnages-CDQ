package ca.balancecdq.android

import android.app.Activity
import android.app.Dialog
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.text.TextUtils
import android.view.Gravity
import android.view.ViewGroup
import android.view.Window
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** A scrollable reader sheet with application names and icons, not activity labels. */
internal object DocumentReaderDialog {
    fun show(
        activity: Activity,
        fileName: String,
        readers: List<DocumentReader>,
        rememberChoice: Boolean,
        onSelected: (DocumentReader) -> Unit,
        onCancel: () -> Unit
    ): Dialog {
        fun dp(value: Int) = (value * activity.resources.displayMetrics.density).toInt()
        fun surface(color: String, radius: Int, stroke: String? = null) = GradientDrawable().apply {
            setColor(Color.parseColor(color))
            cornerRadius = dp(radius).toFloat()
            stroke?.let { setStroke(dp(1), Color.parseColor(it)) }
        }
        fun text(value: String, size: Float, color: String, bold: Boolean = false) = TextView(activity).apply {
            this.text = value
            textSize = size
            setTextColor(Color.parseColor(color))
            if (bold) setTypeface(typeface, Typeface.BOLD)
        }
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val root = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(16))
            background = surface("#0B1C2A", 24, "#234558")
        }
        root.addView(text("Ouvrir le document", 21f, "#F3FAFF", true))
        root.addView(text(fileName, 13f, "#9FB6C7").apply {
            maxLines = 2
            ellipsize = TextUtils.TruncateAt.END
            setPadding(0, dp(6), 0, dp(16))
        })
        val list = LinearLayout(activity).apply { orientation = LinearLayout.VERTICAL }
        var selected = false
        for (reader in readers) {
            val row = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                minimumHeight = dp(72)
                setPadding(dp(14), dp(12), dp(14), dp(12))
                background = RippleDrawable(
                    ColorStateList.valueOf(Color.parseColor("#244C65")),
                    surface("#112B3D", 14, "#24475C"),
                    surface("#FFFFFF", 14)
                )
                isClickable = true
                isFocusable = true
                tag = reader.packageName
                contentDescription = reader.label + if (reader.importOnly) ", importer une copie" else ", ouvrir le document"
                setOnClickListener {
                    if (selected) return@setOnClickListener
                    selected = true
                    dialog.dismiss()
                    onSelected(reader)
                }
            }
            row.addView(ImageView(activity).apply {
                val icon: Drawable? = try { activity.packageManager.getApplicationIcon(reader.packageName) }
                    catch (_: Exception) { null }
                setImageDrawable(icon ?: activity.getDrawable(android.R.drawable.ic_menu_agenda))
                importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }, LinearLayout.LayoutParams(dp(40), dp(40)).apply { marginEnd = dp(14) })
            val labels = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                addView(text(reader.label, 16f, "#F3FAFF", true))
                addView(text(if (reader.importOnly) "Importer une copie" else "Ouvrir le document", 12f, "#9FB6C7").apply {
                    setPadding(0, dp(3), 0, 0)
                })
            }
            row.addView(labels, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            row.addView(text("›", 28f, "#38BDF8").apply {
                setPadding(dp(8), 0, 0, 0)
                importantForAccessibility = android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO
            })
            list.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = dp(8)
            })
        }
        val scroll = ScrollView(activity).apply { addView(list); isFillViewport = false }
        root.addView(scroll, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        root.addView(text(
            if (rememberChoice) "Ce lecteur sera mémorisé." else "Choix pour ce document uniquement.",
            12f, "#9FB6C7"
        ).apply { setPadding(0, dp(10), 0, dp(8)) })
        root.addView(Button(activity).apply {
            text = "Annuler"
            setAllCaps(false)
            textSize = 15f
            setTextColor(Color.parseColor("#D8E9F4"))
            background = surface("#163044", 12)
            minimumHeight = dp(48)
            setOnClickListener { dialog.cancel() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        dialog.setContentView(root)
        dialog.setOnCancelListener { onCancel() }
        dialog.setCanceledOnTouchOutside(true)
        dialog.show()
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            addFlags(android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            val metrics = activity.resources.displayMetrics
            val width = minOf(metrics.widthPixels - dp(24), dp(480))
            // Cap the sheet; long reader lists and large fonts scroll inside it.
            val height = minOf((metrics.heightPixels * .82f).toInt(), dp(210 + readers.size * 80))
            setLayout(width, height)
            setGravity(Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL)
            attributes = attributes.apply { y = dp(12); dimAmount = .55f }
        }
        return dialog
    }
}
