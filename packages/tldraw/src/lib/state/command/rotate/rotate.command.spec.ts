import { TLDrawState } from '../../tlstate'
import { mockDocument } from '../../test-helpers'

describe('Rotate command', () => {
  const tlstate = new TLDrawState()
  tlstate.loadDocument(mockDocument)
  tlstate.select('rect1')

  it('does, undoes and redoes command', () => {
    expect(tlstate.getShape('rect1').rotation).toBe(undefined)

    tlstate.rotate()

    expect(tlstate.getShape('rect1').rotation).toBe(Math.PI * (6 / 4))

    tlstate.undo()

    expect(tlstate.getShape('rect1').rotation).toBe(undefined)

    tlstate.redo()

    expect(tlstate.getShape('rect1').rotation).toBe(Math.PI * (6 / 4))
  })
})