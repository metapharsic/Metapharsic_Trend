# Model Context Protocol (MCP) Configuration

This document specifies the MCP server configurations and custom tooling schemas that expose Pharma OS data safely to AI assistants.

---

## 1. Schema Specifications

MCP servers expose resources and tools via JSON-RPC. Custom tools for the SFA CRM platform are defined below:

### Tool: `query_doctor_intelligence`
- **Description**: Returns the Doctor Intelligence index and competitor push metrics for a given Doctor ID.
- **Arguments**:
```json
{
  "type": "object",
  "properties": {
    "doctorId": { "type": "string", "description": "Target doctor UUID" }
  },
  "required": ["doctorId"]
}
```

### Tool: `detect_suspicious_visits`
- **Description**: Queries DCR check-ins that violated geofence lines or logged mock coordinates.
- **Arguments**:
```json
{
  "type": "object",
  "properties": {
    "date": { "type": "string", "description": "Date to analyze (YYYY-MM-DD)" }
  },
  "required": ["date"]
}
```

---

## 2. Security & Boundaries
- **Access Limits**: MCP database connections must use a read-only user restricted from querying hashed user credentials (`User.passwordHash`).
- **Audit Logging**: Any tool invocation by an AI agent generates an audit trace capturing the execution payload.
