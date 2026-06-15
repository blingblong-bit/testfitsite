import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  friend_name?: string
  referrer_name?: string
  referral_code?: string
}

const ReferralDayPassEmail = ({
  friend_name,
  referrer_name,
  referral_code,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {referrer_name
        ? `${referrer_name} referred you to FIT Beyond Plus — here's your free day pass`
        : 'Your free day pass to FIT Beyond Plus'}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>FIT Beyond Plus</Heading>
        <Text style={text}>Hey {friend_name || 'there'},</Text>
        <Text style={text}>
          <strong>{referrer_name || 'A friend'}</strong> referred you to FIT
          Beyond Plus! Here is your free day pass code:
        </Text>
        <Section style={codeBox}>
          <Text style={codeText}>{referral_code || 'CODE'}</Text>
        </Section>
        <Text style={text}>
          Show this code at the front desk to redeem your free day pass.
        </Text>
        <Text style={text}>We look forward to seeing you!</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ReferralDayPassEmail,
  subject: 'Your Free Day Pass to FIT Beyond Plus',
  displayName: 'Referral Day Pass',
  previewData: {
    friend_name: 'Alex',
    referrer_name: 'Jordan',
    referral_code: 'ABCD1234XY',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Inter, Arial, sans-serif',
  color: '#111111',
}
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = {
  fontSize: '24px',
  fontWeight: 700,
  letterSpacing: '0.04em',
  margin: '0 0 24px',
}
const text = { fontSize: '16px', lineHeight: '24px', margin: '12px 0' }
const codeBox = {
  margin: '24px 0',
  padding: '20px',
  border: '2px solid #111111',
  borderRadius: '8px',
  textAlign: 'center' as const,
}
const codeText = {
  fontSize: '28px',
  letterSpacing: '6px',
  fontWeight: 700,
  fontFamily: 'monospace',
  margin: 0,
}
