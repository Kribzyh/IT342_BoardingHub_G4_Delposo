package com.boardinghub.service;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;

/**
 * Server-Sent Events: pushes {@code refresh} to connected dashboard clients when payments / cash requests change.
 */
@Service
public class DashboardSseService {

    private final Map<String, CopyOnWriteArrayList<SseEmitter>> subscribers = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String email) {
        SseEmitter emitter = new SseEmitter(TimeUnit.MINUTES.toMillis(30));
        CopyOnWriteArrayList<SseEmitter> list = subscribers.computeIfAbsent(email, k -> new CopyOnWriteArrayList<>());
        Runnable remove = () -> {
            list.remove(emitter);
            if (list.isEmpty()) {
                subscribers.remove(email, list);
            }
        };
        emitter.onCompletion(remove);
        emitter.onTimeout(remove);
        emitter.onError(e -> remove.run());
        list.add(emitter);
        try {
            emitter.send(SseEmitter.event().name("connected").data("{}", MediaType.APPLICATION_JSON));
        } catch (IOException e) {
            remove.run();
            throw new IllegalStateException("Could not start SSE stream", e);
        }
        return emitter;
    }

    public void publish(String email) {
        if (email == null || email.isBlank()) {
            return;
        }
        CopyOnWriteArrayList<SseEmitter> list = subscribers.get(email);
        if (list == null || list.isEmpty()) {
            return;
        }
        List<SseEmitter> snapshot = new ArrayList<>(list);
        for (SseEmitter emitter : snapshot) {
            try {
                emitter.send(SseEmitter.event().name("refresh").data("{}", MediaType.APPLICATION_JSON));
            } catch (Exception ex) {
                list.remove(emitter);
            }
        }
    }
}
