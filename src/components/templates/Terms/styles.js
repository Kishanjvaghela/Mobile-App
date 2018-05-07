import { StyleSheet } from 'react-native';

export default StyleSheet.create({
    container: {
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f0f1f3',
        padding: 15
    },
    title: {
        color: '#000',
        fontFamily: 'FuturaStd-Light',
        fontSize: 22,
        marginTop: 90
    },
    paragraph: {
        color: '#444',
        fontFamily: 'FuturaStd-Light',
        fontSize: 17,
        lineHeight: 20,
        marginTop: 25
    },
    buttonsView: {
        display: 'flex',
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between',
        marginTop: 40
    },
    acceptButtonView: {
        display: 'flex',
        flexDirection: 'row',
        width: 158,
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
        borderRadius: 25,
        backgroundColor: '#DA7B61'
    },
    declineButtonView: {
        display: 'flex',
        flexDirection: 'row',
        width: 158,
        justifyContent: 'center',
        alignItems: 'center',
        height: 50,
        borderRadius: 25,
        borderColor: '#DA7B61',
        borderWidth: 1.5,
        backgroundColor: '#f0f1f3'
    },
    acceptButtonText: {
        color: '#fcf9f8',
        fontFamily: 'FuturaStd-Light',
        fontSize: 17
    },
    declineButtonText: {
        color: '#DA7B61',
        fontFamily: 'FuturaStd-Light',
        fontSize: 17
    }
});
