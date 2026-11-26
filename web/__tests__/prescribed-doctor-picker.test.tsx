/**
 * @jest-environment jsdom
 */
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PrescribedDoctorPicker } from "../components/prescribed-doctor-picker";
import { apiClient } from "../lib/api-client";

jest.mock("../lib/api-client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockedGet = apiClient.get as jest.Mock;

describe("PrescribedDoctorPicker — searchable scrollable doctor list & name formatting", () => {
  beforeEach(() => {
    mockedGet.mockResolvedValue({
      data: {
        data: {
          multiple: true,
          autoSelect: false,
          doctors: [
            { id: "d1", fullName: "Dr Mahesh", primarySpecialty: "Mbbs", subArea: "Vijay nagar" },
            { id: "d2", fullName: "Dr. Mohsin", primarySpecialty: "General physician", subArea: "Santosh nagar" },
            { id: "d3", fullName: "Amina Begum", primarySpecialty: "Orthopedics", subArea: "Charminar" },
          ],
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("avoids duplicate Dr. prefix and filters the scrollable doctor grid via search", async () => {
    const onChange = jest.fn();
    render(<PrescribedDoctorPicker chemistId="chem-1" doctorId="" onChange={onChange} />);

    await waitFor(() => expect(screen.getByText("Dr Mahesh")).toBeInTheDocument());
    expect(screen.queryByText("Dr. Dr Mahesh")).not.toBeInTheDocument();
    expect(screen.getByText("Dr. Amina Begum")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Search doctor name, specialty, clinic or area/i);
    fireEvent.change(searchInput, { target: { value: "Charminar" } });

    expect(screen.getByText("Dr. Amina Begum")).toBeInTheDocument();
    expect(screen.queryByText("Dr Mahesh")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Dr. Amina Begum"));
    expect(onChange).toHaveBeenCalledWith("d3");
  });
});
