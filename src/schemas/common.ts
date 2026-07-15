import {type Static, Type} from '@fastify/type-provider-typebox'

export const EmptyObjectSchema = Type.Object({}, {additionalProperties: false})

export const ErrorIssueSchema = Type.Object(
  {
    message: Type.String(),
    path: Type.String(),
  },
  {additionalProperties: false},
)

export const ErrorResponseSchema = Type.Object(
  {
    code: Type.String({minLength: 1}),
    issues: Type.Optional(Type.Array(ErrorIssueSchema)),
    message: Type.String({minLength: 1}),
    status: Type.Integer({maximum: 599, minimum: 400}),
  },
  {additionalProperties: false},
)

export type ErrorIssue = Static<typeof ErrorIssueSchema>
export type ErrorResponse = Static<typeof ErrorResponseSchema>

export function errorResponse(
  status: ErrorResponse['status'],
  code: string,
  message: string,
  issues?: ErrorIssue[],
): ErrorResponse {
  return issues === undefined ? {code, message, status} : {code, issues, message, status}
}
