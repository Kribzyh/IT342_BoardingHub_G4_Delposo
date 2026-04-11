package com.boardinghub.dto;

import com.boardinghub.entity.Room;
import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class DashboardDtos {
    @Data
    @AllArgsConstructor
    public static class PropertyDto {
        private Long id;
        private String name;
        private String address;
        private List<RoomDto> rooms;
    }

    @Data
    @AllArgsConstructor
    public static class RoomDto {
        private Long id;
        private Long propertyId;
        private String roomNumber;
        private BigDecimal monthlyRate;
        private Room.Status status;
        private String enrollmentCode;
        private LocalDateTime enrollmentExpiresAt;
        private TenantDto tenant;
    }

    @Data
    @AllArgsConstructor
    public static class TenantDto {
        private Long id;
        private String fullName;
        private String email;
        private LocalDateTime enrolledAt;
    }

    @Data
    @AllArgsConstructor
    public static class LandlordTenantDto {
        private Long tenantId;
        private String tenantName;
        private String tenantEmail;
        private Long propertyId;
        private String propertyName;
        private Long roomId;
        private String roomNumber;
        private BigDecimal monthlyRate;
        private LocalDateTime enrolledAt;
        /** Current billing month payment: PAID, PENDING, OVERDUE, UPCOMING (same rules as tenant rent tab). */
        private String paymentStatus;
    }

    @Data
    @AllArgsConstructor
    public static class RentDetailsDto {
        private Long propertyId;
        private String propertyName;
        private String propertyAddress;
        private Long roomId;
        private String roomNumber;
        private BigDecimal monthlyRate;
        private LocalDateTime enrolledAt;
    }

    /** Amount due for the current billing period (extends with invoices later). */
    @Data
    @AllArgsConstructor
    public static class TenantCurrentRentDto {
        private BigDecimal amount;
        private String status;
        private String billingMonth;
        /** Calendar days from today until the last day of the billing month (0 on the last day). */
        private Integer remainingDaysInBillingMonth;
    }
}
