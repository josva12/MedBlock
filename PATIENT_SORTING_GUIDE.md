# Patient List Sorting Guide

## Overview

The MedBlock patient list endpoint (`GET /api/v1/patients`) supports flexible sorting capabilities with both legacy and new parameter formats. This guide explains how to use the sorting functionality effectively.

## Supported Sorting Fields

The following fields can be used for sorting:

| Field | Type | Description | Database Field |
|-------|------|-------------|----------------|
| `fullName` | Virtual | Patient's full name (firstName + lastName) | `firstName`, `lastName` |
| `firstName` | String | Patient's first name | `firstName` |
| `lastName` | String | Patient's last name | `lastName` |
| `age` | Virtual | Patient's calculated age | `dateOfBirth` |
| `dateOfBirth` | Date | Patient's date of birth | `dateOfBirth` |
| `patientId` | String | Unique patient identifier | `patientId` |
| `createdAt` | Date | Record creation timestamp | `createdAt` |
| `updatedAt` | Date | Record last update timestamp | `updatedAt` |
| `checkInStatus` | String | Current check-in status | `checkInStatus` |
| `isActive` | Boolean | Patient active status | `isActive` |
| `gender` | String | Patient gender | `gender` |
| `bloodType` | String | Patient blood type | `bloodType` |
| `county` | String | Patient's county | `address.county` |

## Sorting Parameter Formats

### Format 1: Separate Parameters (Recommended)

Use `sortBy` and `sortOrder` parameters for explicit control:

```
GET /api/v1/patients?sortBy=fullName&sortOrder=asc
GET /api/v1/patients?sortBy=createdAt&sortOrder=desc
GET /api/v1/patients?sortBy=age&sortOrder=desc
```

**Parameters:**
- `sortBy`: The field to sort by (must be one of the supported fields)
- `sortOrder`: Sort direction (`asc` for ascending, `desc` for descending)

### Format 2: Legacy Single Parameter

Use a single `sort` parameter with minus prefix for descending:

```
GET /api/v1/patients?sort=fullName
GET /api/v1/patients?sort=-createdAt
GET /api/v1/patients?sort=-age
```

**Format:**
- `sort=fieldName` - Ascending order
- `sort=-fieldName` - Descending order (note the minus prefix)

## Special Field Handling

### Virtual Fields

Some fields are virtual (computed) and require special handling:

#### `fullName` Sorting
- **Database Implementation**: Sorts by `firstName` first, then `lastName`
- **Example**: `GET /api/v1/patients?sortBy=fullName&sortOrder=asc`
- **Result**: Patients sorted alphabetically by full name

#### `age` Sorting
- **Database Implementation**: Sorts by `dateOfBirth` (inverted logic)
- **Example**: `GET /api/v1/patients?sortBy=age&sortOrder=desc`
- **Result**: Oldest patients first (earliest birth dates)

#### `county` Sorting
- **Database Implementation**: Sorts by `address.county`
- **Example**: `GET /api/v1/patients?sortBy=county&sortOrder=asc`
- **Result**: Patients sorted by county name alphabetically

## Complete Examples

### Basic Sorting Examples

```bash
# Sort by full name (A-Z)
GET /api/v1/patients?sortBy=fullName&sortOrder=asc

# Sort by creation date (newest first)
GET /api/v1/patients?sortBy=createdAt&sortOrder=desc

# Sort by age (oldest first)
GET /api/v1/patients?sortBy=age&sortOrder=desc

# Sort by patient ID
GET /api/v1/patients?sortBy=patientId&sortOrder=asc
```

### Combined with Other Parameters

```bash
# Sort with pagination
GET /api/v1/patients?sortBy=fullName&sortOrder=asc&page=1&limit=20

# Sort with filtering
GET /api/v1/patients?sortBy=createdAt&sortOrder=desc&county=Nairobi&isActive=true

# Sort with search
GET /api/v1/patients?sortBy=fullName&sortOrder=asc&search=john

# Complex example
GET /api/v1/patients?sortBy=age&sortOrder=desc&county=Nairobi&gender=male&page=2&limit=10
```

### Legacy Format Examples

```bash
# Ascending by full name
GET /api/v1/patients?sort=fullName

# Descending by creation date
GET /api/v1/patients?sort=-createdAt

# Ascending by age
GET /api/v1/patients?sort=age

# Descending by patient ID
GET /api/v1/patients?sort=-patientId
```

## Response Format

The API response includes debugging information to help troubleshoot sorting:

```json
{
  "success": true,
  "data": {
    "patients": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    },
    "debug": {
      "sortApplied": { "firstName": 1, "lastName": 1 },
      "sortBy": "fullName",
      "sortOrder": "asc",
      "legacySort": null
    }
  }
}
```

## Error Handling

### Invalid Sort Field

```json
{
  "error": "Invalid sort field",
  "details": "Allowed sort fields: createdAt, updatedAt, firstName, lastName, fullName, dateOfBirth, age, patientId, checkInStatus, isActive, gender, bloodType, county"
}
```

### Invalid Sort Order

The system accepts `asc`, `desc`, `ASC`, `DESC` (case-insensitive). Any other value defaults to ascending.

## Performance Considerations

### Indexed Fields
The following fields have database indexes for optimal sorting performance:
- `createdAt` (default sort)
- `firstName`, `lastName`
- `dateOfBirth`
- `address.county`
- `gender`, `bloodType`
- `isActive`

### Virtual Field Performance
- `fullName` sorting requires sorting on two fields (`firstName`, `lastName`)
- `age` sorting uses `dateOfBirth` index but with inverted logic
- Consider using indexed fields for large datasets

## Best Practices

1. **Use the new format** (`sortBy`/`sortOrder`) for better clarity
2. **Combine with pagination** for large datasets
3. **Use indexed fields** for better performance
4. **Test sorting** with your specific data patterns
5. **Monitor query performance** for complex sorting operations

## Troubleshooting

### Common Issues

1. **Sorting not working**: Check if the field is in the allowed list
2. **Unexpected order**: Verify the sort order parameter (`asc`/`desc`)
3. **Performance issues**: Use indexed fields and add pagination
4. **Virtual field problems**: Remember that `fullName` sorts by `firstName` then `lastName`

### Debug Information

The response includes debug information showing:
- `sortApplied`: The actual MongoDB sort object used
- `sortBy`: The requested sort field
- `sortOrder`: The requested sort order
- `legacySort`: The legacy sort parameter (if used)

This information helps identify any issues with parameter parsing or field mapping.

## Pagination

The patient list endpoint supports robust pagination with strict parameter validation.

### Pagination Parameters

- `page`: The page number (positive integer, defaults to 1)
- `limit`: Number of items per page (positive integer, 1-100, defaults to 20)

### Pagination Validation

The API now includes strict validation for pagination parameters:

#### Valid Examples
```
GET /api/v1/patients?page=1&limit=20
GET /api/v1/patients?page=5&limit=50
GET /api/v1/patients?page=1&limit=100  # Maximum limit
```

#### Invalid Examples (Return 400 Error)
```
GET /api/v1/patients?page=0&limit=20      # Page must be > 0
GET /api/v1/patients?page=-1&limit=20     # Page must be positive
GET /api/v1/patients?page=abc&limit=20    # Page must be integer
GET /api/v1/patients?page=1&limit=0       # Limit must be > 0
GET /api/v1/patients?page=1&limit=-5      # Limit must be positive
GET /api/v1/patients?page=1&limit=xyz     # Limit must be integer
GET /api/v1/patients?page=1&limit=101     # Limit cannot exceed 100
GET /api/v1/patients?page=1.5&limit=20    # Page must be integer
GET /api/v1/patients?page=1&limit=20.7    # Limit must be integer
```

### Error Responses

Invalid pagination parameters return a 400 Bad Request with clear error messages:

```json
{
  "success": false,
  "error": "Invalid query parameter",
  "message": "Pagination \"page\" parameter must be a positive integer."
}
```

```json
{
  "success": false,
  "error": "Invalid query parameter",
  "message": "Pagination \"limit\" parameter must be a positive integer."
}
```

```json
{
  "success": false,
  "error": "Invalid query parameter",
  "message": "Pagination \"limit\" cannot exceed 100."
}
```

### Pagination Response Format

```json
{
  "success": true,
  "data": {
    "patients": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

### Debug Information

The API response includes pagination debug information:

```json
{
  "debug": {
    "pagination": {
      "requestedPage": "1",
      "requestedLimit": "20",
      "appliedPage": 1,
      "appliedLimit": 20,
      "skip": 0
    }
  }
}
```

## Sorting 