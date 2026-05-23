import { render, screen } from "@testing-library/react";
import { Button } from "../Button";

test("renders primary button", () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
});

test("renders loading state as disabled", () => {
  render(<Button isLoading>Loading</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});

test("renders disabled state", () => {
  render(<Button disabled>Disabled</Button>);
  expect(screen.getByRole("button")).toBeDisabled();
});
