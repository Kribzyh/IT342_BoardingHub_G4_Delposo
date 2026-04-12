package com.boardinghub.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.boardinghub.mobile.R
import com.boardinghub.mobile.ui.LandingScreen
import com.boardinghub.mobile.ui.PlaceholderAuthScreen
import com.boardinghub.mobile.ui.register.RegisterScreen
import com.boardinghub.mobile.ui.register.RegistrationSuccessScreen
import com.boardinghub.mobile.ui.theme.BoardingHubTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BoardingHubTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val navController = rememberNavController()
                    NavHost(
                        navController = navController,
                        startDestination = "landing"
                    ) {
                        composable("landing") {
                            LandingScreen(
                                onLoginClick = { navController.navigate("login") },
                                onRegisterClick = { navController.navigate("register") }
                            )
                        }
                        composable("login") {
                            PlaceholderAuthScreen(
                                titleRes = R.string.login,
                                onBack = { navController.popBackStack() }
                            )
                        }
                        composable("register") {
                            RegisterScreen(
                                onBack = { navController.popBackStack() },
                                onRegisterSuccess = {
                                    navController.navigate("register_success") {
                                        popUpTo("register") { inclusive = true }
                                        launchSingleTop = true
                                    }
                                }
                            )
                        }
                        composable("register_success") {
                            RegistrationSuccessScreen(
                                onGoToLogin = {
                                    navController.navigate("login") {
                                        popUpTo("landing") { inclusive = false }
                                        launchSingleTop = true
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}
