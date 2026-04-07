package com.boardinghub.strategy;

import org.springframework.stereotype.Component;

import java.util.concurrent.ThreadLocalRandom;

@Component
public class NumericNineDigitCodeStrategy implements CodeGenerationStrategy {
    @Override
    public String generateCode() {
        return String.format("%09d", ThreadLocalRandom.current().nextInt(1_000_000_000));
    }
}
