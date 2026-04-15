package com.boardinghub.repository;

import com.boardinghub.entity.RentPayment;
import com.boardinghub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface RentPaymentRepository extends JpaRepository<RentPayment, Long> {
    Optional<RentPayment> findByPaymongoPaymentIntentId(String paymongoPaymentIntentId);

    boolean existsByTenantAndRecordedAtGreaterThanEqualAndRecordedAtLessThan(
            User tenant,
            LocalDateTime recordedAtStartInclusive,
            LocalDateTime recordedAtEndExclusive
    );

    @Query("""
            SELECT rp FROM RentPayment rp
            JOIN FETCH rp.room r
            JOIN FETCH r.property p
            JOIN FETCH p.landlord
            JOIN FETCH rp.tenant
            WHERE rp.tenant = :tenant
            ORDER BY rp.recordedAt DESC
            """)
    List<RentPayment> findAllForTenant(@Param("tenant") User tenant);

    @Query("""
            SELECT rp FROM RentPayment rp
            JOIN FETCH rp.room r
            JOIN FETCH r.property p
            JOIN FETCH p.landlord
            JOIN FETCH rp.tenant
            WHERE p.landlord = :landlord
            ORDER BY rp.recordedAt DESC
            """)
    List<RentPayment> findAllForLandlord(@Param("landlord") User landlord);
}
