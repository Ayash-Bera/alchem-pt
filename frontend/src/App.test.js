import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Alchemyst Platform', () => {
  render(<App />);
  const element = screen.getByText(/Alchemyst Platform/i);
  expect(element).toBeInTheDocument();
});