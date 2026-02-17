import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

interface Props {
  onSubmit: (ms: number, note: string) => void;
  onCancel: () => void;
}

export default function TimestampPicker({ onSubmit, onCancel }: Props) {
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [note, setNote] = useState('');

  const handleSubmit = () => {
    const m = parseInt(minutes || '0', 10);
    const s = parseInt(seconds || '0', 10);
    const ms = (m * 60 + s) * 1000;
    onSubmit(ms, note);
  };

  const isValid =
    (minutes !== '' || seconds !== '') &&
    parseInt(seconds || '0', 10) < 60;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Timestamp</Text>
      <View style={styles.timeRow}>
        <TextInput
          style={styles.timeInput}
          placeholder="mm"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          maxLength={3}
          value={minutes}
          onChangeText={setMinutes}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          style={styles.timeInput}
          placeholder="ss"
          placeholderTextColor="#666"
          keyboardType="number-pad"
          maxLength={2}
          value={seconds}
          onChangeText={setSeconds}
        />
      </View>
      <TextInput
        style={styles.noteInput}
        placeholder="Note (e.g., chorus, verse 2)"
        placeholderTextColor="#666"
        value={note}
        onChangeText={setNote}
      />
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.submitButton, !isValid && styles.disabled]}
          onPress={handleSubmit}
          disabled={!isValid}
        >
          <Text style={styles.submitText}>Save</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#2a2a2a',
    borderRadius: 16,
    padding: 20,
    margin: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  timeInput: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    width: 80,
    height: 60,
    textAlign: 'center',
    borderRadius: 12,
  },
  colon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  noteInput: {
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#535353',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  submitButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#1DB954',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
});
