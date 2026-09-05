'use client'

// React Imports
import * as React from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createContext, useCallback, useRef, useContext, useLayoutEffect, useMemo, useState } from 'react'

// Third-party Imports
import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import type {
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DropAnimation,
  Modifiers,
  UniqueIdentifier
} from '@dnd-kit/core'
import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DraggableAttributes,
  type DraggableSyntheticListeners
} from '@dnd-kit/core'
import {
  arrayMove,
  defaultAnimateLayoutChanges,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createPortal } from 'react-dom'
import { PlusIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

interface KanbanContextProps<T> {
  columns: Record<string, T[]>
  setColumns: (columns: Record<string, T[]>) => void
  getItemId: (item: T) => string
  columnIds: string[]
  activeId: UniqueIdentifier | null
  setActiveId: (id: UniqueIdentifier | null) => void
  findContainer: (id: UniqueIdentifier) => string | undefined
  isColumn: (id: UniqueIdentifier) => boolean
  modifiers?: Modifiers
}

const KanbanContext = createContext<KanbanContextProps<unknown>>({
  columns: {},
  setColumns: () => {},
  getItemId: () => '',
  columnIds: [],
  activeId: null,
  setActiveId: () => {},
  findContainer: () => undefined,
  isColumn: () => false,
  modifiers: undefined
})

const ColumnContext = createContext<{
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners | undefined
  isDragging?: boolean
  disabled?: boolean
}>({
  attributes: {} as DraggableAttributes,
  listeners: undefined,
  isDragging: false,
  disabled: false
})

const ItemContext = createContext<{
  listeners: DraggableSyntheticListeners | undefined
  isDragging?: boolean
  disabled?: boolean
}>({
  listeners: undefined,
  isDragging: false,
  disabled: false
})

const IsOverlayContext = createContext(false)

const animateLayoutChanges: AnimateLayoutChanges = args => defaultAnimateLayoutChanges({ ...args, wasDragging: true })

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4'
      }
    }
  })
}

export interface KanbanMoveEvent {
  event: DragEndEvent
  activeContainer: string
  activeIndex: number
  overContainer: string
  overIndex: number
}

export interface KanbanRootProps<T> extends Omit<useRender.ComponentProps<'div'>, 'children'> {
  value: Record<string, T[]>
  onValueChange: React.Dispatch<React.SetStateAction<Record<string, T[]>>>
  getItemValue: (item: T) => string
  children: ReactNode
  onMove?: (event: KanbanMoveEvent) => void
  modifiers?: Modifiers

  /**
   * Overrides how a drag resolves to a drop target. Forwards dnd-kit's own `collisionDetection` -
   * boards whose columns resize during a drag need a strategy that cannot feed back into itself.
   */
  collisionDetection?: CollisionDetection
}

function Kanban<T>({
  value,
  onValueChange,
  getItemValue,
  children,
  className,
  render,
  onMove,
  modifiers,
  collisionDetection: collisionDetectionProp,
  ...props
}: KanbanRootProps<T>) {
  const columns = value
  const setColumns = onValueChange
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null)
  const dndContextId = React.useId()

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const columnIds = useMemo(() => Object.keys(columns), [columns])

  const isColumn = useCallback((id: UniqueIdentifier) => columnIds.includes(id as string), [columnIds])

  const findContainer = useCallback(
    (id: UniqueIdentifier) => {
      if (isColumn(id)) return id as string

      return columnIds.find(key => columns[key].some(item => getItemValue(item) === id))
    },
    [columns, columnIds, getItemValue, isColumn]
  )

  const findContainerIn = useCallback(
    (data: Record<string, T[]>, id: UniqueIdentifier) => {
      if (Object.keys(data).includes(id as string)) return id as string

      return Object.keys(data).find(key => data[key].some(item => getItemValue(item) === id))
    },
    [getItemValue]
  )

  const reorderColumns = useCallback(
    (activeColumnId: string, overColumnId: string) => {
      setColumns(prev => {
        const ids = Object.keys(prev)
        const activeIndex = ids.indexOf(activeColumnId)
        const overIndex = ids.indexOf(overColumnId)

        if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
          return prev
        }

        const newOrder = arrayMove(ids, activeIndex, overIndex)
        const newColumns: Record<string, T[]> = {}

        newOrder.forEach(key => {
          newColumns[key] = prev[key]
        })

        return newColumns
      })
    },
    [setColumns]
  )

  const defaultCollisionDetection = useCallback<CollisionDetection>(
    args => {
      if (isColumn(args.active.id)) {
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter(container => isColumn(container.id))
        })
      }

      const pointerIntersections = pointerWithin(args)

      if (pointerIntersections.length > 0) {
        const itemHit = pointerIntersections.find(({ id }) => !isColumn(id))

        return itemHit ? [itemHit] : pointerIntersections.slice(0, 1)
      }

      return closestCenter(args)
    },
    [isColumn]
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id)
  }, [])

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      if (onMove) return

      const { active, over } = event

      if (!over) return

      if (isColumn(active.id)) {
        reorderColumns(active.id as string, over.id as string)

        return
      }

      setColumns(prev => {
        const activeContainer = findContainerIn(prev, active.id)
        const overContainer = findContainerIn(prev, over.id)

        if (!activeContainer || !overContainer) {
          return prev
        }

        if (activeContainer === overContainer) {
          return prev
        }

        const activeItems = prev[activeContainer]
        const overItems = prev[overContainer]
        const activeIndex = activeItems.findIndex((item: T) => getItemValue(item) === active.id)

        if (activeIndex === -1) {
          return prev
        }

        let overIndex = overItems.findIndex((item: T) => getItemValue(item) === over.id)

        if (Object.keys(prev).includes(over.id as string) || overIndex === -1) {
          overIndex = overItems.length
        }

        const movedItem = activeItems[activeIndex]

        return {
          ...prev,
          [activeContainer]: activeItems.filter((item: T) => getItemValue(item) !== active.id),
          [overContainer]: [...overItems.slice(0, overIndex), movedItem, ...overItems.slice(overIndex)]
        }
      })
    },
    [findContainerIn, getItemValue, isColumn, reorderColumns, setColumns, onMove]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)

      if (!over) return

      if (onMove && !isColumn(active.id)) {
        const activeContainer = findContainer(active.id)
        const overContainer = findContainer(over.id)

        if (activeContainer && overContainer) {
          const activeIndex = columns[activeContainer].findIndex((item: T) => getItemValue(item) === active.id)

          const overIndex = isColumn(over.id)
            ? columns[overContainer].length
            : columns[overContainer].findIndex((item: T) => getItemValue(item) === over.id)

          onMove({ event, activeContainer, activeIndex, overContainer, overIndex })
        }

        return
      }

      if (isColumn(active.id)) {
        return
      }

      setColumns(prev => {
        const activeContainer = findContainerIn(prev, active.id)
        const overContainer = findContainerIn(prev, over.id)

        if (!activeContainer || !overContainer || activeContainer !== overContainer) {
          return prev
        }

        const items = prev[activeContainer]
        const activeIndex = items.findIndex((item: T) => getItemValue(item) === active.id)
        const overIndex = items.findIndex((item: T) => getItemValue(item) === over.id)

        if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
          return prev
        }

        return {
          ...prev,
          [activeContainer]: arrayMove(items, activeIndex, overIndex)
        }
      })
    },
    [findContainer, findContainerIn, getItemValue, isColumn, setColumns, onMove, columns]
  )

  const contextValue = useMemo(
    () => ({
      columns,
      setColumns,
      getItemId: getItemValue,
      columnIds,
      activeId,
      setActiveId,
      findContainer,
      isColumn,
      modifiers
    }),
    [columns, setColumns, getItemValue, columnIds, activeId, findContainer, isColumn, modifiers]
  )

  const defaultProps = {
    'data-slot': 'kanban',
    'data-dragging': activeId !== null,
    className: cn(activeId !== null && 'cursor-grabbing!', className),
    children
  }

  return (
    <KanbanContext.Provider value={contextValue as KanbanContextProps<unknown>}>
      <DndContext
        id={dndContextId}
        sensors={sensors}
        modifiers={modifiers}
        collisionDetection={collisionDetectionProp ?? defaultCollisionDetection}
        measuring={{
          droppable: {
            strategy: MeasuringStrategy.Always
          }
        }}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {useRender({
          defaultTagName: 'div',
          render,
          props: mergeProps<'div'>(defaultProps, props)
        })}
      </DndContext>
    </KanbanContext.Provider>
  )
}

export type KanbanBoardProps = useRender.ComponentProps<'div'>

function KanbanBoard({ className, render, ...props }: KanbanBoardProps) {
  const { columnIds } = useContext(KanbanContext)

  const defaultProps = {
    'data-slot': 'kanban-board',
    className: cn('flex gap-4 p-2', className),
    children: props.children
  }

  return (
    <SortableContext items={columnIds} strategy={rectSortingStrategy}>
      {useRender({
        defaultTagName: 'div',
        render,
        props: mergeProps<'div'>(defaultProps, props)
      })}
    </SortableContext>
  )
}

export interface KanbanColumnProps extends useRender.ComponentProps<'div'> {
  value: string
  disabled?: boolean
}

function KanbanColumn({ value, className, render, disabled, ...props }: KanbanColumnProps) {
  const isOverlay = useContext(IsOverlayContext)

  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging: isSortableDragging
  } = useSortable({
    id: value,
    disabled: disabled || isOverlay,
    animateLayoutChanges
  })

  if (isOverlay) {
    const defaultProps = {
      'data-slot': 'kanban-column',
      'data-value': value,
      'data-dragging': true,
      className: cn('group/kanban-column flex flex-col', className),
      children: props.children
    }

    return (
      <ColumnContext.Provider
        value={{
          attributes: {} as DraggableAttributes,
          listeners: undefined,
          isDragging: true,
          disabled: false
        }}
      >
        {/* eslint-disable-next-line react-hooks/rules-of-hooks */}
        {useRender({
          defaultTagName: 'div',
          render,
          props: mergeProps<'div'>(defaultProps, props)
        })}
      </ColumnContext.Provider>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { activeId, isColumn } = useContext(KanbanContext)
  const isColumnDragging = activeId ? isColumn(activeId) : false

  const style = {
    transition,
    transform: CSS.Transform.toString(transform)
  } as CSSProperties

  const defaultProps = {
    'data-slot': 'kanban-column',
    'data-value': value,
    'data-dragging': isSortableDragging,
    'data-disabled': disabled,
    ref: setNodeRef,
    style,
    className: cn(
      'group/kanban-column flex flex-col',
      isSortableDragging && 'z-50 opacity-50',
      disabled && 'opacity-50',
      className
    ),
    children: props.children
  }

  return (
    <ColumnContext.Provider value={{ attributes, listeners, isDragging: isColumnDragging, disabled }}>
      {/* eslint-disable-next-line react-hooks/rules-of-hooks */}
      {useRender({
        defaultTagName: 'div',
        render,
        props: mergeProps<'div'>(defaultProps, props)
      })}
    </ColumnContext.Provider>
  )
}

export interface KanbanColumnHandleProps extends useRender.ComponentProps<'div'> {
  cursor?: boolean
}

function KanbanColumnHandle({ className, render, cursor = true, ...props }: KanbanColumnHandleProps) {
  const { attributes, listeners, isDragging, disabled } = useContext(ColumnContext)

  const defaultProps = {
    'data-slot': 'kanban-column-handle',
    'data-dragging': isDragging,
    'data-disabled': disabled,
    ...attributes,
    ...listeners,
    className: cn(
      'opacity-0 transition-opacity group-hover/kanban-column:opacity-100',
      cursor && (isDragging ? 'cursor-grabbing!' : 'cursor-grab!'),
      className
    ),
    children: props.children
  }

  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(defaultProps, props)
  })
}

export interface KanbanItemProps extends useRender.ComponentProps<'div'> {
  value: string
  disabled?: boolean
}

function KanbanItem({ value, className, render, disabled, ...props }: KanbanItemProps) {
  const isOverlay = useContext(IsOverlayContext)

  const {
    setNodeRef,
    transform,
    transition,
    attributes,
    listeners,
    isDragging: isSortableDragging
  } = useSortable({
    id: value,
    disabled: disabled || isOverlay,
    animateLayoutChanges
  })

  if (isOverlay) {
    const defaultProps = {
      'data-slot': 'kanban-item',
      'data-value': value,
      'data-dragging': true,
      className: cn(className),
      children: props.children
    }

    return (
      <ItemContext.Provider value={{ listeners: undefined, isDragging: true, disabled: false }}>
        {/* eslint-disable-next-line react-hooks/rules-of-hooks */}
        {useRender({
          defaultTagName: 'div',
          render,
          props: mergeProps<'div'>(defaultProps, props)
        })}
      </ItemContext.Provider>
    )
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { activeId, isColumn } = useContext(KanbanContext)
  const isItemDragging = activeId ? !isColumn(activeId) : false

  const style = {
    transition,
    transform: CSS.Transform.toString(transform)
  } as CSSProperties

  const defaultProps = {
    'data-slot': 'kanban-item',
    'data-value': value,
    'data-dragging': isSortableDragging,
    'data-disabled': disabled,
    ref: setNodeRef,
    style,
    ...attributes,
    ...listeners,
    className: cn(isSortableDragging && 'z-50 opacity-50', disabled && 'opacity-50', className),
    children: props.children
  }

  return (
    <ItemContext.Provider value={{ listeners, isDragging: isItemDragging, disabled }}>
      {/* eslint-disable-next-line react-hooks/rules-of-hooks */}
      {useRender({
        defaultTagName: 'div',
        render,
        props: mergeProps<'div'>(defaultProps, props)
      })}
    </ItemContext.Provider>
  )
}

export interface KanbanItemHandleProps extends useRender.ComponentProps<'div'> {
  cursor?: boolean
}

function KanbanItemHandle({ className, render, cursor = true, ...props }: KanbanItemHandleProps) {
  const { listeners, isDragging, disabled } = useContext(ItemContext)

  const defaultProps = {
    'data-slot': 'kanban-item-handle',
    'data-dragging': isDragging,
    'data-disabled': disabled,
    ...listeners,
    className: cn(cursor && (isDragging ? 'cursor-grabbing!' : 'cursor-grab!'), className),
    children: props.children
  }

  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>(defaultProps, props)
  })
}

export interface KanbanColumnContentProps extends useRender.ComponentProps<'div'> {
  value: string
}

function KanbanColumnContent({ value, render, ...props }: KanbanColumnContentProps) {
  const { columns, getItemId } = useContext(KanbanContext)

  const itemIds = useMemo(() => columns[value]?.map(getItemId) ?? [], [columns, getItemId, value])

  const defaultProps = {
    'data-slot': 'kanban-column-content',
    children: props.children
  }

  return (
    <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
      {useRender({
        defaultTagName: 'div',
        render,
        props: mergeProps<'div'>(defaultProps, props)
      })}
    </SortableContext>
  )
}

export interface KanbanOverlayProps extends Omit<React.ComponentProps<typeof DragOverlay>, 'children'> {
  children?: ReactNode | ((params: { value: UniqueIdentifier; variant: 'column' | 'item' }) => ReactNode)
}

function KanbanOverlay({ children, className, ...props }: KanbanOverlayProps) {
  const { activeId, isColumn, modifiers } = useContext(KanbanContext)
  const [mounted, setMounted] = useState(false)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => setMounted(true), [])

  const variant = activeId ? (isColumn(activeId) ? 'column' : 'item') : 'item'

  const content =
    activeId && children ? (typeof children === 'function' ? children({ value: activeId, variant }) : children) : null

  if (!mounted) return null

  return createPortal(
    <DragOverlay
      dropAnimation={dropAnimationConfig}
      modifiers={modifiers}
      className={cn('z-50', activeId && 'cursor-grabbing', className)}
      {...props}
    >
      <IsOverlayContext.Provider value={true}>{content}</IsOverlayContext.Provider>
    </DragOverlay>,
    document.body
  )
}

export interface KanbanAddColumnProps {
  onAdd: (title: string) => void
  validate?: (title: string) => string | undefined
  placeholder?: string
  label?: string
  className?: string
}

function KanbanAddColumn({ onAdd, validate }: KanbanAddColumnProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmed = value.trim()
  const error = trimmed && validate ? validate(trimmed) : undefined

  function handleOpen() {
    setOpen(true)

    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleConfirm() {
    if (!trimmed) return

    if (validate?.(trimmed)) return

    onAdd(trimmed)
    setValue('')
    setOpen(false)
  }

  function handleCancel() {
    setValue('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleConfirm()
    if (e.key === 'Escape') handleCancel()
  }

  if (!open) {
    return (
      <button
        type='button'
        data-slot='kanban-add-column'
        onClick={handleOpen}
        className='border-border text-muted-foreground hover:border-border/80 hover:bg-muted/50 hover:text-foreground flex h-9 w-64 shrink-0 items-center gap-2 rounded-lg border border-dashed bg-transparent px-3 text-sm transition-colors'
      >
        <PlusIcon className='size-4' />
        Add New Column
      </button>
    )
  }

  return (
    <Card data-slot='kanban-add-column' className='bg-muted h-fit shrink-0 py-4'>
      <CardContent className='flex flex-col gap-2.5 px-4'>
        <Input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Add Column Title...'
          className='bg-card'
          aria-invalid={!!error}
          autoFocus
        />
        {error && <p className='text-destructive text-xs'>{error}</p>}
        <div className='flex items-center gap-1.5'>
          <Button size='sm' onClick={handleConfirm} disabled={!trimmed || !!error}>
            Add
          </Button>
          <Button size='sm' variant='outline' onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export interface KanbanAddItemProps {
  onAdd: (title: string) => void
  placeholder?: string
  label?: string
  className?: string
}

function KanbanAddItem({ onAdd }: KanbanAddItemProps) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleOpen() {
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleConfirm() {
    const trimmed = value.trim()

    if (trimmed) {
      onAdd(trimmed)
    }

    setValue('')
    setOpen(false)
  }

  function handleCancel() {
    setValue('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleConfirm()
    }

    if (e.key === 'Escape') handleCancel()
  }

  if (!open) {
    return (
      <button
        type='button'
        data-slot='kanban-add-item'
        onClick={handleOpen}
        className='text-muted-foreground hover:bg-muted hover:text-foreground flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors'
      >
        <PlusIcon className='size-3.5' />
        Add New Item
      </button>
    )
  }

  return (
    <div data-slot='kanban-add-item' className='flex flex-col gap-2'>
      <Textarea
        autoFocus
        ref={textareaRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='Add Content...'
        className='bg-card'
      />
      <div className='flex items-center gap-1.5'>
        <Button size='sm' onClick={handleConfirm}>
          Add card
        </Button>
        <Button size='sm' variant='outline' onClick={handleCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

export {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanColumnContent,
  KanbanOverlay,
  KanbanAddColumn,
  KanbanAddItem
}
