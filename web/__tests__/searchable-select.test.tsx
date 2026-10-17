/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SearchableSelect } from "../components/ui/searchable-select";

describe("SearchableSelect Component", () => {
  const sampleOptions = [
    { value: "doc_1", label: "Dr. Rajesh Sharma (Cardiology)" },
    { value: "doc_2", label: "Dr. Anita Desai (Pediatrics)" },
    { value: "doc_3", label: "Dr. Vikram Seth (Orthopedics)" },
  ];

  it("renders correctly with placeholder when no value is selected", () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        placeholder="Choose Doctor..."
        data-testid="doc-select"
      />
    );

    expect(screen.getAllByText("Choose Doctor...")[0]).toBeInTheDocument();
  });

  it("renders selected option label when controlled value is provided", () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        value="doc_2"
        data-testid="doc-select"
      />
    );

    expect(
      screen.getAllByText("Dr. Anita Desai (Pediatrics)")[0]
    ).toBeInTheDocument();
  });

  it("extracts options dynamically from JSX <option> children", () => {
    render(
      <SearchableSelect value="chem_1" placeholder="Select Chemist">
        <option value="">Select Chemist</option>
        <option value="chem_1">Apollo Pharmacy - Connaught Place</option>
        <option value="chem_2">MedPlus Chemist - Hauz Khas</option>
      </SearchableSelect>
    );

    expect(
      screen.getAllByText("Apollo Pharmacy - Connaught Place")[0]
    ).toBeInTheDocument();
  });

  it("opens dropdown popover and live-filters options when typing in search input", async () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        placeholder="Choose Doctor..."
        data-testid="doc-select"
      />
    );

    // Click trigger to open
    const trigger = screen.getByTestId("doc-select-trigger");
    fireEvent.click(trigger);

    // Check search input is visible
    const searchInput = screen.getByPlaceholderText(
      "Type to search / filter..."
    );
    expect(searchInput).toBeInTheDocument();

    // Type "pediatrics" in search bar
    fireEvent.change(searchInput, { target: { value: "pediatrics" } });

    // In custom listbox, Anita Desai should be present
    const listbox = screen.getByRole("listbox");
    expect(
      within(listbox).getByText("Dr. Anita Desai (Pediatrics)")
    ).toBeInTheDocument();

    // Dr. Rajesh Sharma should not be in the listbox
    expect(
      within(listbox).queryByText("Dr. Rajesh Sharma (Cardiology)")
    ).not.toBeInTheDocument();
  });

  it("selects an option and fires synthetic onChange with e.target.value", () => {
    const handleChange = jest.fn();
    const handleValueChange = jest.fn();

    render(
      <SearchableSelect
        options={sampleOptions}
        name="doctorId"
        onChange={handleChange}
        onValueChange={handleValueChange}
        data-testid="doc-select"
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId("doc-select-trigger"));

    // Click option within listbox
    const listbox = screen.getByRole("listbox");
    const option = within(listbox).getByText("Dr. Vikram Seth (Orthopedics)");
    fireEvent.click(option);

    // Verify onChange received synthetic event with target.value = doc_3
    expect(handleChange).toHaveBeenCalledTimes(1);
    const eventArg = handleChange.mock.calls[0][0];
    expect(eventArg.target.value).toBe("doc_3");
    expect(eventArg.target.name).toBe("doctorId");

    // Verify onValueChange was called with raw string
    expect(handleValueChange).toHaveBeenCalledWith("doc_3");
  });

  it("clears selection when allowClear is enabled and clear icon is clicked", () => {
    const handleChange = jest.fn();

    render(
      <SearchableSelect
        options={sampleOptions}
        value="doc_1"
        allowClear
        onChange={handleChange}
        data-testid="doc-select"
      />
    );

    const clearBtn = screen.getByTitle("Clear selection");
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange.mock.calls[0][0].target.value).toBe("");
  });
});
