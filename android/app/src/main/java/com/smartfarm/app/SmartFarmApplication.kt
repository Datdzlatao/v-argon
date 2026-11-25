package com.smartfarm.app

import android.app.Application
import com.smartfarm.app.data.local.SessionManager

class SmartFarmApplication : Application() {

    companion object {
        lateinit var instance: SmartFarmApplication
            private set
    }

    val sessionManager: SessionManager by lazy {
        SessionManager(this)
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
