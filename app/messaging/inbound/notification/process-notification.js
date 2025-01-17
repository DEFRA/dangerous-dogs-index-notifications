const { v4: uuidv4 } = require('uuid')
const templates = require('../../../constants/notification-templates')
const { notify } = require('../../../config')
const { getNotificationType } = require('./get-notification-type')
const { validate } = require('./schemas/notification-data-schema')
const { NotifyClient } = require('notifications-node-client')
const { getAttachmentFile } = require('../../../storage/attachments')
const { POST_APPLICATION_PACK } = require('../../../constants/notification-types')

const client = new NotifyClient(notify.apiKey)

const processNotification = async notification => {
  let type
  let reference
  try {
    const data = notification.data

    validate(data)

    type = getNotificationType(notification.type)

    const customFields = data.personalisation?.personalisation
    reference = customFields?.index_number

    if (customFields?.file_key_to_attach) {
      const filename = customFields[customFields.file_key_to_attach]
      const fileContents = await getAttachmentFile(filename)

      if (type === POST_APPLICATION_PACK) {
        reference = `${customFields.index_number}_${uuidv4()}`
        await client.sendPrecompiledLetter(reference, fileContents)
      } else {
        const options = { confirmEmailBeforeDownload: false }
        if (customFields.filename_for_display) {
          options.filename = customFields.filename_for_display
        }

        customFields[customFields.file_key_to_attach] = client.prepareUpload(fileContents, options)
        delete customFields.file_key_to_attach

        await client.sendEmail(templates[type],
          data.emailAddress,
          { personalisation: customFields }
        )
      }
    } else {
      await client.sendEmail(templates[type],
        data.emailAddress,
        data.personalisation
      )
    }
  } catch (err) {
    console.error(`Unable to process notification of type ${type} and reference ${reference}:`, err.response?.data?.errors)

    throw err
  }
}

module.exports = {
  processNotification
}
