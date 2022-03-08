import { Account, Bucket, Charity, Community, Transaction } from '../types'
import { MoonbeamCall } from '@subql/contract-processors/dist/moonbeam';
import { BigNumber, logger } from "ethers";

type BucketArray = {
  [bucketIndex: number]: number[];
}

type StorePixelArgs = [Array<any>] & {
  pixelInputs: Array<any>;
  _charityId: String;
  _communityId: String;
};

export async function handleStorePixels(event: MoonbeamCall<StorePixelArgs>): Promise<void> {
  logger.info(event.success)
  logger.info(event.args._charityId)
  const id = `${event.hash}`
  const { success } = event
  if(!success) return
  // const price = event.args[0].price?.toBigInt()

  let totalPixelCount = event.args.pixelInputs.length

  // Save account
  let accountAddress = event.from

  let account = await Account.get(accountAddress)

  if(!account) {
    account = new Account(accountAddress)
    account.address = accountAddress
    account.totalPixelsPlaced = totalPixelCount
    await account.save()
  } else {
    account.totalPixelsPlaced = account.totalPixelsPlaced + totalPixelCount
    await account.save()
  }

  // Save charity
  let charityId = event.args._charityId.toString()
  let charity = await Charity.get(charityId)

  if(!charity) {
    charity = new Charity(charityId)
    charity.name = charityId
    charity.totalPixelsReceived = totalPixelCount
    await charity.save()
  } else {
    charity.totalPixelsReceived = totalPixelCount + charity.totalPixelsReceived
    await charity.save()
  }

  // Save community
  let communityId = event.args._communityId.toString()
  let community = await Community.get(communityId)

  if(!community) {
    community = new Charity(communityId)
    community.name = communityId
    community.totalPixelsReceived = totalPixelCount
    await community.save()
  } else {
    community.totalPixelsReceived = totalPixelCount + community.totalPixelsReceived
    await community.save()
  }

  let pixelInputs = []

  for (let step = 0; step < event.args.pixelInputs.length; step++) {

    const _pixelInput = event.args.pixelInputs[step]
    pixelInputs.push({
      bucket: _pixelInput[0].toString(),
      posInBucket: _pixelInput[1],
      color: _pixelInput[2],
    })
  }
  
  const bucketArr: BucketArray = {};
  const bucketLength = 16;

  for(let i = 0; i < pixelInputs.length; i++) {
    const input = pixelInputs[i]

    if (bucketArr[input.bucket] == null || bucketArr[input.bucket].length <= 0)
    bucketArr[input.bucket] = Array<number>(bucketLength).fill(0);

    bucketArr[input.bucket][input.posInBucket] = input.color;
  }
  

  const bucketsPromises = pixelInputs.map(async (pixelInput) => {
    const bucketId = `${pixelInput.bucket}`

    const bucket = await Bucket.get(bucketId)
 
     if(!bucket) {
       // logger.info(`ADDED BUCKET #${bucketId}`)
       // bucket doesn't exist create a bucket
       let bucket = new Bucket(bucketId)
       bucket.id = bucketId
       bucket.position = pixelInput.bucket
       // grab the pixel array from bucketArr
       bucket.pixels = bucketArr[pixelInput.bucket]
       bucket.lastBlockUpdated = event.blockNumber
 
       await bucket.save()
       logger.info(`ADDED BUCKET #${bucket.position}, With pixels ${bucket.pixels}`)
 
     } else {
       // bucket exists
      
       let oldPixels = bucket.pixels
       let newPixels = bucketArr[pixelInput.bucket]

       let combinedPixels = []

       for(let i = 0; i < bucket.pixels.length; i++) {
         const newPixel = newPixels[i]

         // if position is 0, it means no need to override
         // and save the old one
         if(newPixel === 0) {
           combinedPixels[i] = oldPixels[i]
         } else {
           combinedPixels[i] = newPixels[i]
         }
       }

       bucket.pixels = combinedPixels
       
       // update block #
       bucket.lastBlockUpdated = event.blockNumber
       
       logger.info(`UPDATED BUCKET #${bucketId}: New Array: ${combinedPixels}`)
       await bucket.save()
     }
  })

  await Promise.all(bucketsPromises)
}
