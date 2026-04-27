import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const envDir = path.resolve(currentDir, '..')

dotenv.config({ path: path.join(envDir, '.env.local') })
dotenv.config({ path: path.join(envDir, '.env') })
