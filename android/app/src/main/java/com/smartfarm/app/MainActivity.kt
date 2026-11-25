package com.smartfarm.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.smartfarm.app.ui.components.FarmTopAppBar
import com.smartfarm.app.ui.navigation.FarmBottomNavigation
import com.smartfarm.app.ui.navigation.Screen
import com.smartfarm.app.ui.screens.*
import com.smartfarm.app.ui.theme.SmartFarmTheme
import com.smartfarm.app.ui.viewmodel.FarmViewModel

class MainActivity : ComponentActivity() {

    private val viewModel: FarmViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            SmartFarmTheme {
                val userSession by viewModel.userSession.collectAsState()

                if (userSession == null) {
                    AuthScreen(viewModel = viewModel)
                } else {
                    MainAppScaffold(viewModel = viewModel)
                }
            }
        }
    }
}

@Composable
fun MainAppScaffold(viewModel: FarmViewModel) {
    val navController = rememberNavController()
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Home.route

    val currentMode by viewModel.currentMode.collectAsState()
    val wsConnected by viewModel.wsConnected.collectAsState()
    val activeAlerts by viewModel.activeAlerts.collectAsState()
    val isMuted by viewModel.isMuted.collectAsState()
    val userSession by viewModel.userSession.collectAsState()
    val realtimeToast by viewModel.realtimeToast.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    // Show realtime toast via Snackbar
    LaunchedEffect(realtimeToast) {
        realtimeToast?.let { msg ->
            snackbarHostState.showSnackbar(
                message = msg,
                duration = SnackbarDuration.Short
            )
        }
    }

    Scaffold(
        topBar = {
            if (currentRoute != Screen.AIChat.route) {
                FarmTopAppBar(
                    currentMode = currentMode,
                    onModeChange = { viewModel.setMode(it) },
                    wsConnected = wsConnected,
                    unreadAlertsCount = activeAlerts.size,
                    isMuted = isMuted,
                    onToggleMute = { viewModel.toggleMute() },
                    userEmail = userSession?.email,
                    onLogout = { viewModel.logout() }
                )
            }
        },
        bottomBar = {
            if (currentRoute != Screen.AIChat.route) {
                FarmBottomNavigation(
                    currentRoute = currentRoute,
                    onNavigate = { route ->
                        navController.navigate(route) {
                            popUpTo(Screen.Home.route) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    viewModel = viewModel,
                    onOpenChat = { navController.navigate(Screen.AIChat.route) }
                )
            }

            composable(Screen.LivestockCrops.route) {
                LivestockCropsScreen(viewModel = viewModel)
            }

            composable(Screen.Attendance.route) {
                AttendanceScreen(viewModel = viewModel)
            }

            composable(Screen.CameraAction.route) {
                CameraActionScreen(viewModel = viewModel)
            }

            composable(Screen.Inventory.route) {
                InventoryScreen(viewModel = viewModel)
            }

            composable(Screen.AIChat.route) {
                AIChatScreen(
                    viewModel = viewModel,
                    onBack = { navController.popBackStack() }
                )
            }
        }
    }
}
