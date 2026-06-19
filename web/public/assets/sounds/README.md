# Sound Effects for Chat

This directory contains sound effects for the chat functionality. The app will automatically use these sounds if available, otherwise it will fall back to generated tones.

## Required Sound Files

Place the following audio files in this directory:

- `message-sent.mp3` - Sound played when sending a message
- `message-received.mp3` - Sound played when receiving a message  
- `notification.mp3` - Sound played for notifications (new messages when chat is closed)
- `typing.mp3` - Sound played for typing indicators

## Audio Format Requirements

- **Format**: MP3 (recommended) or WAV
- **Duration**: Keep under 1 second for best UX
- **Quality**: 128kbps or higher
- **Volume**: Normalized to avoid sudden loud sounds

## Fallback Sounds

If no audio files are found, the app will automatically generate simple tones using the Web Audio API:
- Message sent: 800Hz sine wave
- Message received: 600Hz sine wave  
- Notification: 800Hz + 1000Hz double tone
- Typing: 400Hz square wave

## Customization

You can replace these files with your own custom sounds. Popular options include:
- WhatsApp-style notification sounds
- Modern UI sound effects
- Subtle chime sounds
- Professional notification tones

## Testing

After adding sound files, refresh the page and test the chat functionality to ensure sounds are working correctly.