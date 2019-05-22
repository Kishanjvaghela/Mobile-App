import { StyleSheet } from 'react-native';
import { getFontSize } from '../../../utils/designUtils';

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: '#f0f1f3'
    },

    bodyRows: {
        flex: 1,
        flexDirection: 'column',
    },

    doneButtonText: {
        color: '#ffffff',
        fontFamily: 'FuturaStd-Light',
        fontSize: getFontSize(17),
    },
    ChildText:{
        fontFamily: 'futura',
        fontSize: getFontSize(17),
        marginLeft: 15,
    },
    doneButtonView: {
        flex: 1,
        flexDirection: 'column',
        width: '100%',
        backgroundColor: '#DA7B61',
        justifyContent: 'center',
        alignItems: 'center',
        height:50,
    },

    bottomView: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        padding:10,
        height:70,
    },
});

export default styles;
