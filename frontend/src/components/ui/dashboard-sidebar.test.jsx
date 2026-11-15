import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GridFour, SquaresFour } from '@phosphor-icons/react';
import { CommandSearch } from './dashboard-sidebar';

const entries = [
  { id: '/dashboard', title: 'Dashboard', hint: 'Overview', icon: SquaresFour },
  { id: '/components', title: 'All components', hint: 'List', icon: GridFour },
];

const setup = (open = true) => {
  const onClose = vi.fn();
  const onPick = vi.fn();
  const view = render(<CommandSearch open={open} onClose={onClose} entries={entries} onPick={onPick} />);
  return { onClose, onPick, ...view };
};

describe('CommandSearch', () => {
  it('renders nothing while closed', () => {
    setup(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('focuses the query field when opened', () => {
    setup();
    expect(screen.getByPlaceholderText(/search components/i)).toHaveFocus();
  });

  it('filters entries and picks the highlighted one with Enter', () => {
    const { onPick, onClose } = setup();
    const input = screen.getByPlaceholderText(/search components/i);
    fireEvent.change(input, { target: { value: 'compo' } });
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith('/components');
    expect(onClose).toHaveBeenCalled();
  });

  it('starts with an empty query each time it opens', () => {
    const { rerender } = setup();
    fireEvent.change(screen.getByPlaceholderText(/search components/i), { target: { value: 'dash' } });
    const props = { onClose: vi.fn(), entries, onPick: vi.fn() };
    rerender(<CommandSearch open={false} {...props} />);
    rerender(<CommandSearch open {...props} />);
    expect(screen.getByPlaceholderText(/search components/i)).toHaveValue('');
  });

  it('closes on Escape and on the backdrop', () => {
    const { onClose } = setup();
    fireEvent.keyDown(screen.getByPlaceholderText(/search components/i), { key: 'Escape' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Close search' })[0]);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
