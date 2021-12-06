/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  intersectLineSegmentBounds,
  intersectLineSegmentPolyline,
  intersectPolygonBounds,
} from '@tldraw/intersect'
import { action, computed, makeObservable, observable } from 'mobx'
import type { AnyObject, TLNuBounds, TLNuBoundsCorner, TLNuBoundsEdge, TLNuHandle } from '~types'
import { isPlainObject, BoundsUtils, PointUtils, assignOwnProps } from '~utils'
import { deepCopy } from '~utils/DataUtils'

export interface TLNuShapeClass<S extends TLNuShape> {
  new (props: any): S
  id: string
}

export interface TLNuIndicatorProps<M = unknown> {
  meta: M
  isEditing: boolean
  isBinding: boolean
  isHovered: boolean
  isSelected: boolean
}

export interface TLNuShapeProps {
  id: string
  parentId: string
  point: number[]
  rotation?: number
  name?: string
  children?: string[]
  handles?: Record<string, TLNuHandle>
  isGhost?: boolean
  isHidden?: boolean
  isLocked?: boolean
  isGenerated?: boolean
  isAspectRatioLocked?: boolean
}

const serializableTypes = new Set(['string', 'number', 'boolean', 'undefined'])

function isSerializable(value: any): boolean {
  if (serializableTypes.has(typeof value) || value === null) return true
  if (Array.isArray(value)) return value.every(isSerializable)
  if (isPlainObject(value)) return Object.values(value).every(isSerializable)
  return false
}

export type TLNuSerializedShape<P = AnyObject> = TLNuShapeProps & {
  type: string
  nonce?: number
} & P

export interface TLNuComponentProps<M = unknown> extends TLNuIndicatorProps<M> {
  events: {
    onPointerMove: React.PointerEventHandler
    onPointerDown: React.PointerEventHandler
    onPointerUp: React.PointerEventHandler
    onPointerEnter: React.PointerEventHandler
    onPointerLeave: React.PointerEventHandler
    onKeyUp: React.KeyboardEventHandler
    onKeyDown: React.KeyboardEventHandler
  }
}

export interface TLNuResizeInfo<P extends AnyObject = any> {
  type: TLNuBoundsEdge | TLNuBoundsCorner
  scaleX: number
  scaleY: number
  transformOrigin: number[]
  initialBounds: TLNuBounds
  initialProps: TLNuShapeProps & P
}

export abstract class TLNuShape<P extends AnyObject = any, M = unknown> implements TLNuShapeProps {
  constructor(props: TLNuShapeProps & Partial<P>) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.type = this.constructor['id']
    this.init(props)
    makeObservable(this)
  }

  static type: string

  readonly showCloneHandles = false
  readonly hideBounds = false
  readonly isStateful = false
  readonly type: string
  readonly id: string = 'id'
  @observable parentId = 'parentId'
  @observable point: number[] = [0, 0]
  @observable name?: string = 'Shape'
  @observable rotation?: number
  @observable children?: string[]
  @observable handles?: Record<string, TLNuHandle>
  @observable isGhost?: boolean
  @observable isHidden?: boolean
  @observable isLocked?: boolean
  @observable isGenerated?: boolean
  @observable isAspectRatioLocked?: boolean

  abstract readonly Component: (props: TLNuComponentProps<M>) => JSX.Element | null
  abstract readonly Indicator: (props: TLNuIndicatorProps<M>) => JSX.Element | null

  protected init = (props: TLNuShapeProps & Partial<P>) => {
    assignOwnProps(this, props)
  }

  abstract getBounds: () => TLNuBounds

  getCenter = () => {
    return BoundsUtils.getBoundsCenter(this.bounds)
  }

  getRotatedBounds = () => {
    const { bounds, rotation } = this
    if (!rotation) return bounds
    return BoundsUtils.getBoundsFromPoints(BoundsUtils.getRotatedCorners(bounds, rotation))
  }

  hitTestPoint = (point: number[]): boolean => {
    const ownBounds = this.rotatedBounds

    if (!this.rotation) {
      return PointUtils.pointInBounds(point, ownBounds)
    }

    const corners = BoundsUtils.getRotatedCorners(ownBounds, this.rotation)

    return PointUtils.pointInPolygon(point, corners)
  }

  hitTestLineSegment = (A: number[], B: number[]): boolean => {
    const box = BoundsUtils.getBoundsFromPoints([A, B])
    const { rotatedBounds, rotation = 0 } = this

    return BoundsUtils.boundsContain(rotatedBounds, box) || rotation
      ? intersectLineSegmentPolyline(A, B, BoundsUtils.getRotatedCorners(this.bounds)).didIntersect
      : intersectLineSegmentBounds(A, B, rotatedBounds).length > 0
  }

  hitTestBounds = (bounds: TLNuBounds): boolean => {
    const { rotatedBounds } = this

    if (!this.rotation) {
      return (
        BoundsUtils.boundsContain(bounds, rotatedBounds) ||
        BoundsUtils.boundsContain(rotatedBounds, bounds) ||
        BoundsUtils.boundsCollide(rotatedBounds, bounds)
      )
    }

    const corners = BoundsUtils.getRotatedCorners(this.bounds, this.rotation)

    return (
      BoundsUtils.boundsContain(bounds, rotatedBounds) ||
      intersectPolygonBounds(corners, bounds).length > 0
    )
  }

  onResize = (bounds: TLNuBounds, info: TLNuResizeInfo<P>) => {
    this.update({ point: [bounds.minX, bounds.minY] })
    return this
  }

  onResizeStart?: () => void

  @computed get center(): number[] {
    return this.getCenter()
  }

  @computed get bounds(): TLNuBounds {
    return this.getBounds()
  }

  @computed get rotatedBounds(): TLNuBounds {
    return this.getRotatedBounds()
  }

  @computed get serialized(): TLNuSerializedShape<P> {
    return deepCopy(
      Object.fromEntries(Object.entries(this).filter(([_key, value]) => isSerializable(value)))
    ) as TLNuSerializedShape<P>
  }

  get shapeId(): string {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.constructor['id']
  }

  set shapeId(type: string) {
    // noop, but easier if this exists
  }

  nonce = 0

  protected bump(): this {
    this.nonce++
    return this
  }

  @action update(props: Partial<TLNuShapeProps | P>) {
    Object.assign(this, props)
    if (!('nonce' in props)) this.bump()
    return this
  }
}
