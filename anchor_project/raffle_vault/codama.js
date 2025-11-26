// NOTE: The local createCodamaConfig is a temporary workaround until gill ships the fix for https://github.com/gillsdk/gill/issues/207
// Future versions can "import { createCodamaConfig } from 'gill'" directly
import { createCodamaConfig } from './create-codama-config.js'

export default createCodamaConfig({
  clientJs: "../frontend/src/lib/codama", //clientJs: 'client/js/generated',
  idl: 'target/idl/raffle_vault.json',
})
