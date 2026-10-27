import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AstraOrb } from './AstraOrb'

describe('AstraOrb', () => {
  it('announces its authoritative state accessibly', () => {
    render(<AstraOrb state="LISTENING" level={0.5}/>)
    expect(screen.getByRole('img', {name: /astra is listening/i})).toBeInTheDocument()
  })
})
