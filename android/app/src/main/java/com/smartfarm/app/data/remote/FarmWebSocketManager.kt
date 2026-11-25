package com.smartfarm.app.data.remote

import android.util.Log
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.*
import java.util.concurrent.TimeUnit

data class WebSocketPacket(
    val event: String,
    val data: JsonObject?
)

class FarmWebSocketManager {
    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private var webSocket: WebSocket? = null
    private val gson = Gson()
    private var isConnected = false
    private var shouldReconnect = true
    private val coroutineScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private val _events = MutableSharedFlow<WebSocketPacket>(extraBufferCapacity = 64)
    val events = _events.asSharedFlow()

    private val _connectionStatus = MutableSharedFlow<Boolean>(replay = 1)
    val connectionStatus = _connectionStatus.asSharedFlow()

    fun connect() {
        shouldReconnect = true
        val request = Request.Builder()
            .url(ApiConfig.wsUrl)
            .build()

        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.d("FarmWebSocket", "Connected to Smart Farm WebSocket")
                isConnected = true
                _connectionStatus.tryEmit(true)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                try {
                    val obj = gson.fromJson(text, JsonObject::class.java)
                    val event = obj.get("event")?.asString ?: "message"
                    val data = obj.getAsJsonObject("data")
                    _events.tryEmit(WebSocketPacket(event, data))
                } catch (e: Exception) {
                    Log.e("FarmWebSocket", "Error parsing message: $text", e)
                }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
                isConnected = false
                _connectionStatus.tryEmit(false)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                isConnected = false
                _connectionStatus.tryEmit(false)
                attemptReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.w("FarmWebSocket", "WebSocket connection failure: ${t.message}")
                isConnected = false
                _connectionStatus.tryEmit(false)
                attemptReconnect()
            }
        })
    }

    private fun attemptReconnect() {
        if (!shouldReconnect) return
        coroutineScope.launch {
            delay(3000)
            if (!isConnected && shouldReconnect) {
                Log.d("FarmWebSocket", "Reconnecting WebSocket...")
                connect()
            }
        }
    }

    fun disconnect() {
        shouldReconnect = false
        webSocket?.close(1000, "Normal closure")
        webSocket = null
        isConnected = false
        _connectionStatus.tryEmit(false)
    }
}
