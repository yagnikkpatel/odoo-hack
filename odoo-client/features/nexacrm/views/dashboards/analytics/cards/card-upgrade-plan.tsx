'use client'

import { usePaymentInputs } from 'react-payment-inputs'
import images, { type CardImages } from 'react-payment-inputs/images'

import { EllipsisVerticalIcon, WalletIcon, CreditCardIcon } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/features/nexacrm/components/ui/avatar'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent, CardHeader } from '@/features/nexacrm/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/features/nexacrm/components/ui/input-group'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'

import { cn } from '@/features/nexacrm/lib/utils'

const listItems = ['Share', 'Update', 'Refresh']

const UpgradeYourPlanCard = ({ className }: { className?: string }) => {
  const { meta, getCardNumberProps, getCardImageProps, getCVCProps } = usePaymentInputs()

  return (
    <Card className={cn('justify-between', className)}>
      <CardHeader>
        <div className='flex items-center justify-between gap-2'>
          <span className='text-lg font-semibold'>Upgrade your plan</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant='ghost' size='icon' className='text-muted-foreground size-6 rounded-full' />}
            >
              <EllipsisVerticalIcon />
              <span className='sr-only'>Menu</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuGroup>
                {listItems.map((item, index) => (
                  <DropdownMenuItem key={index}>{item}</DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className='text-muted-foreground text-sm'>
          To fully enjoy all the amazing features and benefits of our premium plan.
        </p>
      </CardHeader>
      <CardContent>
        <div className='bg-primary/10 flex items-center justify-between gap-2 rounded-md px-2 py-1.5'>
          <div className='flex items-center gap-2'>
            <Avatar className='size-9 rounded-sm after:rounded-[inherit]'>
              <AvatarFallback className='bg-background text-primary shrink-0 rounded-sm'>
                <WalletIcon className='size-6' />
              </AvatarFallback>
            </Avatar>
            <div className='flex flex-col'>
              <span className='text-base font-medium'>Platinum</span>
              <span className='text-muted-foreground text-sm'>Billed annually</span>
            </div>
          </div>
          <div className='flex items-baseline'>
            <span className='text-xl font-medium'>$5,550</span>
            <span className='text-base'>/Year</span>
          </div>
        </div>
      </CardContent>
      <CardContent>
        <div className='flex flex-col gap-4'>
          <span className='text-base font-semibold'>Payment details</span>
          <div className='flex flex-col gap-3'>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <div className='bg-muted rounded-sm p-2'>
                  <img src='/images/brands/mastercard-icon.webp' alt='master-card' className='w-8' />
                </div>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-sm font-medium'>Credit card</span>
                  <span className='text-muted-foreground text-xs'>5688 xxxx xxxx 2356</span>
                </div>
              </div>
              <Input {...getCVCProps()} className='h-7 max-w-16' />
            </div>
            <div className='flex items-center justify-between gap-2'>
              <div className='flex items-center gap-2'>
                <div className='bg-muted rounded-sm px-2 py-3'>
                  <img src='/images/brands/visa-icon.webp' alt='visa' className='w-8' />
                </div>
                <div className='flex flex-col gap-0.5'>
                  <span className='text-sm font-medium'>Credit card</span>
                  <span className='text-muted-foreground text-xs'>8562 xxxx xxxx 4563</span>
                </div>
              </div>
              <Input {...getCVCProps()} className='h-7 max-w-16' />
            </div>
          </div>
        </div>
      </CardContent>
      <CardContent className='space-y-3'>
        <Label htmlFor='addCard' className='text-base font-semibold'>
          Add Payment method
        </Label>
        <InputGroup className='h-9'>
          <InputGroupInput {...getCardNumberProps()} id='addCard' placeholder='Card Number' className='h-9' />
          <InputGroupAddon className='h-9' align='inline-end'>
            {meta.cardType ? (
              <svg
                className='w-6 overflow-hidden'
                {...getCardImageProps({
                  images: images as unknown as CardImages
                })}
              />
            ) : (
              <CreditCardIcon className='size-4' />
            )}
          </InputGroupAddon>
        </InputGroup>
        <Button size='lg' className='w-full'>
          Pay now
        </Button>
      </CardContent>
    </Card>
  )
}

export default UpgradeYourPlanCard
