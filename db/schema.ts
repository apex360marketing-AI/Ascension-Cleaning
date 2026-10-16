// Every website lead, kept so Kayla's dashboard works whether or not
// GoHighLevel received it. `status` is her own follow-up pipeline.
import { pgTable, serial, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core'

export const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'booked', 'lost'] as const

export const leads = pgTable(
  'leads',
  {
    id: serial().primaryKey(),
    kind: text().notNull(),
    name: text().notNull().default(''),
    email: text().notNull().default(''),
    phone: text().notNull().default(''),
    fields: jsonb().$type<Record<string, string>>().notNull().default({}),
    extra: jsonb().$type<Record<string, string>>().notNull().default({}),
    page: text().notNull().default(''),
    status: text().notNull().default('new'),
    notes: text().notNull().default(''),
    // null = not attempted (no webhook set), true/false = GHL's answer
    ghlDelivered: boolean('ghl_delivered'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('leads_created_at_idx').on(t.createdAt), index('leads_status_idx').on(t.status)],
)
