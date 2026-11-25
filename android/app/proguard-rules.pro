# ProGuard rules for SmartFarm Android App
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
-keep class com.smartfarm.app.data.models.** { *; }
