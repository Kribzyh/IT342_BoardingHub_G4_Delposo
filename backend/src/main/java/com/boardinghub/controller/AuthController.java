package com.boardinghub.controller;

import com.boardinghub.dto.AuthRequest;
import com.boardinghub.dto.AuthResponse;
import com.boardinghub.dto.RegisterRequest;
import com.boardinghub.entity.User;
import com.boardinghub.repository.UserRepository;
import com.boardinghub.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@RestController
@RequestMapping("/auth")
public class AuthController {
    @Autowired
    private AuthenticationManager authenticationManager;
    @Autowired
    private JwtUtil jwtUtil;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().body("Email already in use");
        }

        User user = new User();
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setFullName(request.getFullName());
        user.setRole(request.getRole());
        user = userRepository.save(user);

        String token = jwtUtil.generateToken(user.getEmail());

        AuthResponse.UserDto userDto = new AuthResponse.UserDto(
                user.getId(), user.getEmail(), user.getFullName(), user.getRole());
        AuthResponse response = new AuthResponse(token, null, userDto);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
            UserDetails userDetails = (UserDetails) authentication.getPrincipal();
            String token = jwtUtil.generateToken(userDetails.getUsername());

            User user = userRepository.findByEmail(userDetails.getUsername()).orElseThrow();
            AuthResponse.UserDto userDto = new AuthResponse.UserDto(
                    user.getId(), user.getEmail(), user.getFullName(), user.getRole());
            AuthResponse response = new AuthResponse(token, null, userDto);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid email or password");
        }
    }

    @PostMapping("/google")
    public ResponseEntity<?> googleLogin(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body("Missing Google token");
        }
        // Only required for first-time Google users (when the email is not present in the DB yet).
        String fullName = request.get("fullName");
        String role = request.get("role");
        if (role == null || role.isBlank()) {
            role = "TENANT";
        }
        role = role.toUpperCase();

        RestTemplate restTemplate = new RestTemplate();
        String url = "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" + token;
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            Map<String, Object> attributes = response.getBody();
            if (attributes == null || attributes.get("email") == null) {
                return ResponseEntity.status(401).body("Invalid Google token");
            }

            String email = (String) attributes.get("email");
            String name = (String) attributes.getOrDefault("name", email);

            User user = userRepository.findByEmail(email).orElse(null);
            if (user == null) {
                if (fullName == null || fullName.isBlank()) {
                    return ResponseEntity
                            .status(HttpStatus.PRECONDITION_REQUIRED)
                            .body(Map.of(
                                    "code", "FULL_NAME_REQUIRED",
                                    "email", email,
                                    "suggestedFullName", name
                            ));
                }
                user = new User();
                user.setEmail(email);
                user.setFullName(fullName);
                user.setPassword("");
                try {
                    user.setRole(User.Role.valueOf(role));
                } catch (IllegalArgumentException e) {
                    user.setRole(User.Role.TENANT);
                }
                user = userRepository.save(user);
            } else {
                // Update role if a specific role was provided
                try {
                    user.setRole(User.Role.valueOf(role));
                    user = userRepository.save(user);
                } catch (IllegalArgumentException e) {
                    // Keep existing role if invalid role provided
                }
            }

            String jwt = jwtUtil.generateToken(user.getEmail());
            AuthResponse.UserDto userDto = new AuthResponse.UserDto(
                    user.getId(), user.getEmail(), user.getFullName(), user.getRole());
            AuthResponse authResponse = new AuthResponse(jwt, null, userDto);
            return ResponseEntity.ok(authResponse);
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid Google token");
        }
    }
}