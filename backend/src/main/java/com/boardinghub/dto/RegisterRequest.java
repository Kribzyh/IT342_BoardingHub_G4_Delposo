package com.boardinghub.dto;

import com.boardinghub.entity.User.Role;
import lombok.Data;

@Data
public class RegisterRequest {
    private String email;
    private String password;
    private String fullName;
    private Role role;
}