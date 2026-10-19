import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';

/** Full-screen barcode scanner; reports the first EAN/UPC it reads. */
export function ScannerModal({ visible, onScanned, onClose }: { visible: boolean; onScanned: (code: string) => void; onClose: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  // The camera fires several callbacks for the same code before the modal closes.
  const handled = useRef(false);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={() => { handled.current = false; }}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              onScanned(data);
            }}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.text}>AzoApp necesita la cámara para leer el código de barras.</Text>
            <Pressable style={styles.button} onPress={requestPermission}>
              <Text style={styles.buttonText}>Permitir cámara</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.frame} pointerEvents="none" />
        <Text style={styles.hint}>Apuntá al código de barras del producto</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Cerrar</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  text: { color: '#fff', textAlign: 'center', fontSize: 16 },
  button: { backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
  frame: { position: 'absolute', top: '35%', left: '10%', right: '10%', height: 160, borderWidth: 3, borderColor: '#fff', borderRadius: 16 },
  hint: { position: 'absolute', top: 70, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '600' },
  close: { position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  closeText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
