package com.smartfarm.app.data.remote

object ApiConfig {
    // Configurable URLs with fallback to active Tailscale & Supabase instances
    var backendUrl: String = "https://dat-latitude-5590-2.tail2bda46.ts.net:8443"
    var faceApiUrl: String = "https://dat-latitude-5590-2.tail2bda46.ts.net:10000"
    var actionApiUrl: String = "https://dat-latitude-5590-2.tail2bda46.ts.net"
    
    val wsUrl: String
        get() = if (backendUrl.startsWith("https://")) {
            backendUrl.replace("https://", "wss://") + "/ws"
        } else {
            backendUrl.replace("http://", "ws://") + "/ws"
        }

    val actionWsUrl: String
        get() {
            val base = actionApiUrl.trimEnd('/')
            return if (base.startsWith("https://")) {
                base.replaceFirst("https://", "wss://")
            } else {
                base.replaceFirst("http://", "ws://")
            }
        }

    val faceWsUrl: String
        get() {
            val base = faceApiUrl.trimEnd('/')
            return if (base.startsWith("https://")) {
                base.replaceFirst("https://", "wss://")
            } else {
                base.replaceFirst("http://", "ws://")
            }
        }

    const val SUPABASE_URL = "https://sopqsxhuitqcmnvosjeq.supabase.co"
    const val SUPABASE_KEY = "sb_publishable_PdB8mBs-zLvYDpEXP-ds4A_YSktC8lm"
}
