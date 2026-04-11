package com.boardinghub.controller;

import com.boardinghub.service.DashboardSseService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/dashboard")
@RequiredArgsConstructor
public class DashboardStreamController {

    private final DashboardSseService dashboardSseService;

    /**
     * SSE stream for live dashboard updates. Browser EventSource cannot send Authorization headers;
     * pass JWT as query param {@code token} (see {@link com.boardinghub.security.JwtAuthenticationFilter}).
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(Authentication authentication) {
        return dashboardSseService.subscribe(authentication.getName());
    }
}
