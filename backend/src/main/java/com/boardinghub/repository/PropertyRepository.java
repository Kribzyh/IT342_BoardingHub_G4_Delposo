package com.boardinghub.repository;

import com.boardinghub.entity.Property;
import com.boardinghub.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PropertyRepository extends JpaRepository<Property, Long> {
    List<Property> findByLandlordOrderByCreatedAtDesc(User landlord);
}
