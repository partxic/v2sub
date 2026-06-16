<script setup>
import { defineProps, defineEmits } from 'vue'

const prop = defineProps({
    show: {
        type: Boolean,
        required: true
    },
    data: {
        type: Object,
        required: true
    },
    loading: {
        type: Boolean,
        required: true
    }
})

const emit = defineEmits(['save', 'close'])

const handleClose = done => {
    done()
    emit('close')
}
</script>

<template>
    <el-dialog :model-value="prop.show" title="源编辑器" width="90%" :before-close="handleClose" align-center>
        <el-form :model="prop.data" label-width="auto">
            <el-form-item label="名称">
                <el-input v-model="prop.data.name" />
            </el-form-item>
            <el-form-item label="地址">
                <el-input v-model="prop.data.url" />
            </el-form-item>
            <el-form-item label="排除">
                <el-input v-model="prop.data.exclude" placeholder="以 ',' 分隔" />
            </el-form-item>
            <el-form-item>
                <el-button type="primary" :loading="prop.loading" @click="emit('save')">保存</el-button>
                <el-button :loading="prop.loading" @click="emit('close')">取消</el-button>
            </el-form-item>
        </el-form>
    </el-dialog>
</template>

<style scoped></style>
