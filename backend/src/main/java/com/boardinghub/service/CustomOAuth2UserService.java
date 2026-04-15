package com.boardinghub.service;

import com.boardinghub.entity.User;
import com.boardinghub.repository.UserRepository;
import com.boardinghub.security.CustomOAuth2User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oauth2User = super.loadUser(userRequest);
        Map<String, Object> attributes = oauth2User.getAttributes();

        String email = (String) attributes.get("email");
        String name = (String) attributes.get("name");
        

        // Check if user exists in our database
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            // Create a new user (default role = TENANT, can be changed later)
            user = new User();
            user.setEmail(email);
            user.setFullName(name);
            user.setPassword(""); // no password for OAuth2 users
            user.setRole(User.Role.TENANT); // default role, let user choose later
            userRepository.save(user);
        }

        
        return new CustomOAuth2User(user, attributes);
    }
}