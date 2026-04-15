package com.boardinghub.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpdateRoomRequest {
    private String roomNumber;
    private BigDecimal monthlyRate;
}
