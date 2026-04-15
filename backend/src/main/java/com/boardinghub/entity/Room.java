package com.boardinghub.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "rooms")
@Data
@NoArgsConstructor
public class Room {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "property_id", nullable = false)
    private Property property;

    @Column(name = "room_number", nullable = false)
    private String roomNumber;

    @Column(name = "monthly_rate", nullable = false, precision = 12, scale = 2)
    private BigDecimal monthlyRate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.AVAILABLE;

    @Column(name = "enrollment_code", length = 9)
    private String enrollmentCode;

    @Column(name = "enrollment_expires_at")
    private LocalDateTime enrollmentExpiresAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    private User tenant;

    @Column(name = "enrolled_at")
    private LocalDateTime enrolledAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public enum Status {
        AVAILABLE, OCCUPIED
    }
}
