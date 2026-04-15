package com.boardinghub.controller;

import com.boardinghub.dto.CreatePropertyRequest;
import com.boardinghub.dto.CreateRoomRequest;
import com.boardinghub.dto.DashboardDtos;
import com.boardinghub.dto.EnrollRequest;
import com.boardinghub.dto.UpdateRoomRequest;
import com.boardinghub.service.PropertyRoomService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class PropertyRoomController {
    private final PropertyRoomService propertyRoomService;

    @GetMapping("/properties")
    public ResponseEntity<List<DashboardDtos.PropertyDto>> getProperties(Authentication authentication) {
        return ResponseEntity.ok(propertyRoomService.getLandlordProperties(authentication.getName()));
    }

    @PostMapping("/properties")
    public ResponseEntity<DashboardDtos.PropertyDto> createProperty(
            Authentication authentication,
            @RequestBody CreatePropertyRequest request
    ) {
        return ResponseEntity.ok(propertyRoomService.createProperty(authentication.getName(), request));
    }

    @PutMapping("/properties/{propertyId}")
    public ResponseEntity<DashboardDtos.PropertyDto> updateProperty(
            Authentication authentication,
            @PathVariable Long propertyId,
            @RequestBody CreatePropertyRequest request
    ) {
        return ResponseEntity.ok(propertyRoomService.updateProperty(authentication.getName(), propertyId, request));
    }

    @DeleteMapping("/properties/{propertyId}")
    public ResponseEntity<Void> deleteProperty(Authentication authentication, @PathVariable Long propertyId) {
        propertyRoomService.deleteProperty(authentication.getName(), propertyId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/rooms")
    public ResponseEntity<DashboardDtos.RoomDto> createRoom(
            Authentication authentication,
            @RequestBody CreateRoomRequest request
    ) {
        return ResponseEntity.ok(propertyRoomService.createRoom(authentication.getName(), request));
    }

    @PutMapping("/rooms/{roomId}")
    public ResponseEntity<DashboardDtos.RoomDto> updateRoom(
            Authentication authentication,
            @PathVariable Long roomId,
            @RequestBody UpdateRoomRequest request
    ) {
        return ResponseEntity.ok(propertyRoomService.updateRoom(authentication.getName(), roomId, request));
    }

    @DeleteMapping("/rooms/{roomId}")
    public ResponseEntity<Void> deleteRoom(Authentication authentication, @PathVariable Long roomId) {
        propertyRoomService.deleteRoom(authentication.getName(), roomId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/rooms/{roomId}/generate-code")
    public ResponseEntity<DashboardDtos.RoomDto> generateCode(Authentication authentication, @PathVariable Long roomId) {
        return ResponseEntity.ok(propertyRoomService.generateCode(authentication.getName(), roomId));
    }

    @PostMapping("/tenant/enroll")
    public ResponseEntity<DashboardDtos.RentDetailsDto> enrollTenant(
            Authentication authentication,
            @RequestBody EnrollRequest request
    ) {
        return ResponseEntity.ok(propertyRoomService.enrollTenant(authentication.getName(), request));
    }

    @GetMapping("/tenant/rent")
    public ResponseEntity<DashboardDtos.RentDetailsDto> getTenantRent(Authentication authentication) {
        return ResponseEntity.ok(propertyRoomService.getTenantRentDetails(authentication.getName()));
    }
}
