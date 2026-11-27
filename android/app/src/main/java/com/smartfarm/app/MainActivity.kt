package com.smartfarm.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
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

    val navigateToTab: (String) -> Unit = { route ->
        if (route == Screen.Home.route) {
            val popped = navController.popBackStack(Screen.Home.route, inclusive = false)
            if (!popped) {
                navController.navigate(Screen.Home.route) {
                    launchSingleTop = true
                }
            }
        } else {
            navController.navigate(route) {
                popUpTo(navController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

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
                    onLogout = { viewModel.logout() },
                    onOpenExtendedModules = { navigateToTab(Screen.ExtendedModules.route) }
                )
            }
        },
        bottomBar = {
            if (currentRoute != Screen.AIChat.route) {
                FarmBottomNavigation(
                    currentRoute = currentRoute,
                    onNavigate = navigateToTab
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
                    onOpenChat = { navController.navigate(Screen.AIChat.route) },
                    onNavigateItem = { item ->
                        when (item.actionRoute) {
                            "inventory" -> {
                                viewModel.showToast("Đang mở kho: ${item.targetId ?: "Vật tư"}")
                                navigateToTab(Screen.Inventory.route)
                            }
                            "livestock" -> {
                                viewModel.setMode("livestock")
                                viewModel.showToast("Đang mở hồ sơ ${item.targetId ?: "vật nuôi"} tại ${item.title}")
                                navigateToTab(Screen.LivestockCrops.route)
                            }
                            "crops" -> {
                                viewModel.setMode("cultivation")
                                viewModel.showToast("Đang kiểm tra cây trồng tại ${item.title}")
                                navigateToTab(Screen.LivestockCrops.route)
                            }
                            "camera" -> navigateToTab(Screen.CameraAction.route)
                            "devices", "env" -> viewModel.showToast("Đang xem khu vực ${item.title}")
                            else -> navController.navigate(Screen.AIChat.route)
                        }
                    }
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

            composable(Screen.ExtendedModules.route) {
                ExtendedModulesScreen(onBack = { navController.popBackStack() })
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
