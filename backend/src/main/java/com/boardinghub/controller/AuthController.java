package com.boardinghub.controller;

import com.boardinghub.dto.AuthRequest;
import com.boardinghub.dto.AuthResponse;
import com.boardinghub.dto.RegisterRequest;
import com.boardinghub.entity.User;
import com.boardinghub.repository.UserRepository;
import com.boardinghub.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

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
}