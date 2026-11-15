import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import {
  Card,
  DataTable,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  SegmentedControl,
  StatusBadge,
  TASK_STATUS,
} from '@/components';

describe('Card', () => {
  it('renders a header only when there is something to put in it', () => {
    const { container, rerender } = render(<Card>body</Card>);
    expect(container.querySelector('.card-h')).toBeNull();
    rerender(<Card title="Task status" hint="2 of 3" actions={<button>Export</button>} />);
    expect(screen.getByRole('heading', { name: 'Task status' })).toBeInTheDocument();
    expect(screen.getByText('2 of 3')).toHaveClass('hint');
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('runs content edge to edge when flush', () => {
    const { container } = render(<Card flush title="Steps" />);
    expect(container.firstChild).toHaveClass('card', 'tbl');
  });
});

describe('StatusBadge', () => {
  it('combines shape and tone into classes', () => {
    render(
      <StatusBadge tone="warning" shape="pill">
        In progress
      </StatusBadge>,
    );
    expect(screen.getByText('In progress')).toHaveClass('pill', 'tone-warning');
  });

  it('is a non-submitting button when rendered as one', () => {
    const onClick = vi.fn();
    render(
      <StatusBadge as="button" shape="toggle" tone="positive" onClick={onClick}>
        Yes
      </StatusBadge>,
    );
    const button = screen.getByRole('button', { name: 'Yes' });
    expect(button).toHaveAttribute('type', 'button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('defines a tone for every task status', () => {
    expect(TASK_STATUS.map((s) => s.label)).toEqual(['Pending', 'In progress', 'Done']);
    TASK_STATUS.forEach((s) => expect(s.tone).toBeTruthy());
  });
});

describe('DataTable', () => {
  it('renders column headers and the rows it is given', () => {
    render(
      <DataTable columns={['Task', 'Status']}>
        <tr>
          <td>Install</td>
          <td>Done</td>
        </tr>
      </DataTable>,
    );
    expect(screen.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Task', 'Status']);
    expect(screen.getByRole('cell', { name: 'Install' })).toBeInTheDocument();
  });

  it('fills one full-width row with the empty message', () => {
    render(<DataTable columns={['A', 'B', 'C']} isEmpty empty="No responses yet." />);
    expect(screen.getByRole('cell', { name: 'No responses yet.' })).toHaveAttribute('colspan', '3');
  });
});

describe('FormField', () => {
  it('labels its control and links hint and error to it', () => {
    render(
      <FormField label="User name" number={1} hint="As in the directory" error="Required">
        {(f) => <input {...f.control} />}
      </FormField>,
    );
    const input = screen.getByRole('textbox', { name: /user name/i });
    expect(input).toHaveAccessibleDescription('As in the directory Required');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('labels a group of buttons through aria-labelledby', () => {
    render(
      <FormField label="Allow edit?" group>
        {(f) => (
          <div role="group" {...f.control}>
            <button>Yes</button>
          </div>
        )}
      </FormField>,
    );
    expect(screen.getByRole('group', { name: 'Allow edit?' })).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  const yesNo = [
    [1, 'Yes'],
    [0, 'No', 'off'],
  ];

  it('shows the lime pill for the selected choice, and the neutral pill for an "off" choice', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SegmentedControl id="t" value={0} options={yesNo} onChange={onChange} aria-label="Allow edit?" />);
    const yes = screen.getByRole('button', { name: 'Yes' });
    const no = screen.getByRole('button', { name: 'No' });
    expect(no).toHaveAttribute('aria-pressed', 'true');
    expect(no.querySelector('.seg-bg')).not.toHaveClass('positive');

    fireEvent.click(yes);
    expect(onChange).toHaveBeenCalledWith(1);
    rerender(<SegmentedControl id="t" value={1} options={yesNo} onChange={onChange} aria-label="Allow edit?" />);
    expect(yes).toHaveClass('on', 'positive');
    expect(yes.querySelector('.seg-bg')).toHaveClass('positive');
  });

  it('uses the lime pill for any selected choice without a tone', () => {
    const hml = [
      ['H', 'High'],
      ['M', 'Med'],
      ['L', 'Low'],
    ];
    render(<SegmentedControl id="b" value="M" options={hml} onChange={() => {}} aria-label="Bandwidth" />);
    expect(screen.getByRole('button', { name: 'Med' }).querySelector('.seg-bg')).toHaveClass('positive');
  });
});

describe('states', () => {
  it('EmptyState renders as the tag it is given', () => {
    render(
      <ul>
        <EmptyState as="li">Nothing recorded yet.</EmptyState>
      </ul>,
    );
    expect(screen.getByRole('listitem')).toHaveClass('empty');
  });

  it('LoadingState announces itself politely', () => {
    render(<LoadingState label="Loading projects" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading projects');
  });

  it('ErrorState shows the message and retries', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="The server did not answer." onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('The server did not answer.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

function DialogHarness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose();
    setOpen(false);
  };
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog
        open={open}
        onClose={close}
        title="Delete row?"
        description="This cannot be undone."
        actions={
          <>
            <button onClick={close}>Cancel</button>
            <button onClick={close}>Delete</button>
          </>
        }
      />
    </>
  );
}

describe('Dialog', () => {
  it('is named by its title and described by its description', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete row?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('moves focus inside, keeps Tab inside, and returns focus on close', () => {
    render(<DialogHarness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const close = screen.getByRole('button', { name: 'Close' });
    const last = screen.getByRole('button', { name: 'Delete' });
    expect(close).toHaveFocus();

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(last).toHaveFocus();

    fireEvent.keyDown(last, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('stops the page behind from scrolling while open', () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.body.style.overflow).toBe('');
  });
});
