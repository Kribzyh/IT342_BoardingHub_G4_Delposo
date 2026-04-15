package com.boardinghub.event;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
public class DashboardEventListener {
    @EventListener
    public void onRoomCodeGenerated(RoomCodeGeneratedEvent event) {
        System.out.println("Room code generated for roomId=" + event.roomId());
    }

    @EventListener
    public void onTenantEnrolled(TenantEnrolledEvent event) {
        System.out.println("Tenant enrolled tenantId=" + event.tenantId() + " roomId=" + event.roomId());
    }
}
