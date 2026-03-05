import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StickyStatsBar } from './StickyStatsBar';

describe('StickyStatsBar — Category tab glow (Phase 3 #8)', () => {
  it('active tab has scale-105 class', () => {
    render(<StickyStatsBar activeCategory="flower" onCategoryChange={vi.fn()} />);
    const flowerTab = screen.getByText('Flower');
    expect(flowerTab.className).toContain('scale-105');
  });

  it('active tab has glow shadow', () => {
    render(<StickyStatsBar activeCategory="flower" onCategoryChange={vi.fn()} />);
    const flowerTab = screen.getByText('Flower');
    expect(flowerTab.className).toContain('shadow-[0_0_8px_rgba(168,85,247,0.15)]');
  });

  it('active tab has purple background and border', () => {
    render(<StickyStatsBar activeCategory="flower" onCategoryChange={vi.fn()} />);
    const flowerTab = screen.getByText('Flower');
    expect(flowerTab.className).toContain('bg-purple-500/20');
    expect(flowerTab.className).toContain('border-purple-500/30');
  });

  it('inactive tabs lack scale-105', () => {
    render(<StickyStatsBar activeCategory="flower" onCategoryChange={vi.fn()} />);
    const vapeTab = screen.getByText('Vapes');
    expect(vapeTab.className).not.toContain('scale-105');
    expect(vapeTab.className).toContain('scale-100');
  });

  it('clicking a category calls onCategoryChange', () => {
    const onChange = vi.fn();
    render(<StickyStatsBar activeCategory="all" onCategoryChange={onChange} />);
    screen.getByText('Flower').click();
    expect(onChange).toHaveBeenCalledWith('flower');
  });
});
