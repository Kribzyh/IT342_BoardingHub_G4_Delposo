package com.boardinghub.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class CreateRoomRequest {
    private Long propertyId;
    private String roomNumber;
    private BigDecimal monthlyRate;
}
