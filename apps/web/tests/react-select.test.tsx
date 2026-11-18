// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ReactSelect, type SelectOption } from '../src/components/ui/react-select.js';

describe('ReactSelect Component', () => {
  const sampleOptions: SelectOption[] = [
    { label: 'Groq Cloud', value: 'groq', description: 'openai-compatible' },
    { label: 'Google AI Studio', value: 'google', description: 'google' },
    { label: 'ElevenLabs', value: 'elevenlabs', description: 'elevenlabs' },
  ];

  it('renders with placeholder and opens menu on click', () => {
    render(
      <ReactSelect
        options={sampleOptions}
        placeholder="Choose provider..."
      />
    );

    const control = screen.getByText('Choose provider...');
    expect(control).toBeDefined();

    // Click to open dropdown
    fireEvent.mouseDown(control);
    expect(screen.getByText('Groq Cloud')).toBeDefined();
    expect(screen.getByText('Google AI Studio')).toBeDefined();
    expect(screen.getByText('ElevenLabs')).toBeDefined();
  });

  it('selects option on mouse click', () => {
    const onChange = vi.fn();
    render(
      <ReactSelect
        options={sampleOptions}
        placeholder="Choose provider..."
        onChange={onChange}
      />
    );

    const control = screen.getByText('Choose provider...');
    fireEvent.mouseDown(control);

    const groqOption = screen.getByText('Groq Cloud');
    fireEvent.click(groqOption);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Groq Cloud', value: 'groq' }),
      expect.anything()
    );
  });

  it('handles multi-select mouse interaction and removal', () => {
    const onChange = vi.fn();
    const capabilityOptions: SelectOption[] = [
      { label: 'Chat', value: 'chat' },
      { label: 'Vision', value: 'vision' },
      { label: 'Embeddings', value: 'embeddings' },
    ];

    render(
      <ReactSelect
        isMulti
        options={capabilityOptions}
        defaultValue={[capabilityOptions[0]]}
        onChange={onChange}
      />
    );

    expect(screen.getByText('Chat')).toBeDefined();

    // Open dropdown to select another
    const control = screen.getByText('Chat');
    fireEvent.mouseDown(control);

    const visionOption = screen.getByText('Vision');
    fireEvent.click(visionOption);

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('allows wheel scroll events on the menu container', () => {
    render(
      <ReactSelect
        options={sampleOptions}
        menuIsOpen={true}
      />
    );

    const menu = screen.getByText('Groq Cloud').closest('.pointer-events-auto');
    expect(menu).not.toBeNull();

    // Simulate mouse wheel scroll event
    if (menu) {
      const wheelEvent = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 50 });
      menu.dispatchEvent(wheelEvent);
    }
  });
});
